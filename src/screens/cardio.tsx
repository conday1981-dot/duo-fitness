/** Cardio: live GPS runs with interval cues, GPX import, manual entries, history. */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Path, Circle } from 'react-native-svg';
import { useStore } from '../core/store';
import type { CardioSession, CardioType, GeoPoint, IntervalStep } from '../core/types';
import { clock, distOut, dUnit, niceDate, num, pace, round, uid, ymd } from '../core/util';
import { acceptFix, haversine, intervalAt, kcal, MET, MET_SOURCE, parseGpx, totalMins } from '../domain/cardio';
import { latestWeight } from '../domain/progress';
import { Button, Card, Chip, Empty, Field, Label, ListItem, Notice, ProgressBar, Row, Screen, Segmented, Sheet, Stat, Txt, useNow, useTheme } from '../ui/kit';
import { useNav } from '../ui/nav';
import { keepAwake, pickTextFile, speak } from '../platform/device';

const TYPE_LABEL: Record<CardioType, string> = { walk: 'Walk', jog: 'Jog', run: 'Run', intervals: 'Intervals', cycle: 'Cycle' };

export function RouteSketch({ points, height = 160 }: { points: GeoPoint[]; height?: number }) {
  const t = useTheme();
  if (points.length < 2) return null;
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const [minLa, maxLa, minLo, maxLo] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const k = Math.cos((((minLa + maxLa) / 2) * Math.PI) / 180);
  const w = Math.max((maxLo - minLo) * k, maxLa - minLa) || 1e-6;
  const xy = (p: GeoPoint) => [10 + (((p[1] - minLo) * k) / w) * 300, height - 10 - ((p[0] - minLa) / w) * (height - 20)];
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map((v) => v.toFixed(1)).join(' ')}`).join(' ');
  const end = xy(points[points.length - 1]);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 320 ${height}`} accessibilityRole="image" accessibilityLabel="Route shape">
      <Path d={d} stroke={t.accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={end[0]} cy={end[1]} r={6} fill={t.accent} />
    </Svg>
  );
}

function guessType(distanceM: number, secs: number): CardioType {
  const kmh = secs ? distanceM / 1000 / (secs / 3600) : 0;
  return kmh < 6.5 ? 'walk' : kmh < 9.5 ? 'jog' : kmh < 20 ? 'run' : 'cycle';
}

export function CardioHome() {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const mine = data.cardio.filter((c) => c.profileId === profile?.id).sort((a, b) => b.startedAt - a.startedAt);
  const [steps, setSteps] = useState('5 walk, 5 jog, 5 walk');
  const [target, setTarget] = useState('');
  const [manual, setManual] = useState(false);
  const [msg, setMsg] = useState('');
  const parsedSteps: IntervalStep[] = steps.split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p.length === 2 && num(p[0])).map(([m, k]) => ({ mins: num(m)!, kind: (['walk', 'jog', 'run'].includes(k) ? k : 'walk') as IntervalStep['kind'] }));
  const routeTargetM = num(target) ? (u === 'metric' ? num(target)! * 1000 : num(target)! * 1609.344) : undefined;

  const importGpx = async () => {
    setMsg('');
    try {
      const f = await pickTextFile('.gpx,application/gpx+xml,text/xml');
      if (!f || !profile) return;
      const g = parseGpx(f.text);
      const s: CardioSession = { id: uid(), profileId: profile.id, type: guessType(g.distanceM, g.durationS), startedAt: g.startedAt, durationS: g.durationS, distanceM: g.distanceM, source: 'gpx', points: g.points.filter((_, i) => i % 3 === 0) };
      update((d) => { d.cardio.push(s); });
      setMsg(`Imported ${g.name ?? f.name}: ${round(distOut(g.distanceM, u), 2)} ${dUnit(u)} in ${clock(g.durationS)}.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <Screen title="Cardio">
      <Notice>In the web app, GPS only records while DUO is open on screen (it keeps the screen on for you). For runs with the phone locked, record in another app and import the GPX file here.</Notice>
      <Label>Start</Label>
      <Row wrap>
        {(['walk', 'jog', 'run', 'cycle'] as CardioType[]).map((k) => <Button key={k} small kind="secondary" title={TYPE_LABEL[k]} onPress={() => nav.push('run', { type: k, routeTargetM })} />)}
      </Row>
      <Card>
        <Label>Intervals</Label>
        <Field label="Steps (minutes + walk/jog/run)" value={steps} onChangeText={setSteps} autoCapitalize="none" />
        <Txt size={13} color={t.muted}>{parsedSteps.length ? `${parsedSteps.length} steps · ${totalMins(parsedSteps)} min` : 'e.g. 5 walk, 5 jog, 5 walk'}</Txt>
        <Button title="Start intervals" icon="play" disabled={!parsedSteps.length} onPress={() => nav.push('run', { type: 'intervals', steps: parsedSteps, routeTargetM })} />
      </Card>
      <Field label={`Planned route length (${dUnit(u)}, optional)`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Shows distance left" />
      <Row>
        <Button flex kind="secondary" title="Import GPX" icon="upload" onPress={importGpx} />
        <Button flex kind="secondary" title="Log manually" icon="plus" onPress={() => setManual(true)} />
      </Row>
      {msg ? <Notice>{msg}</Notice> : null}
      <Label>History</Label>
      {mine.length ? mine.slice(0, 30).map((c) => (
        <ListItem key={c.id} icon="run" title={`${TYPE_LABEL[c.type]} · ${round(distOut(c.distanceM, u), 2)} ${dUnit(u)}`} sub={`${niceDate(c.startedAt)} · ${clock(c.durationS)} · ${pace(c.distanceM, c.durationS, u)}${c.source === 'gpx' ? ' · imported' : ''}`} onPress={() => nav.push('cardioDetail', { id: c.id })} />
      )) : <Empty title="No cardio yet" />}
      <ManualSheet visible={manual} onClose={() => setManual(false)} />
    </Screen>
  );
}

function ManualSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, update } = useStore();
  const u = profile?.units ?? 'metric';
  const [type, setType] = useState<CardioType>('walk');
  const [dist, setDist] = useState('');
  const [mins, setMins] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Log cardio">
      <Row wrap gap={6}>{(Object.keys(TYPE_LABEL) as CardioType[]).map((k) => <Chip key={k} label={TYPE_LABEL[k]} on={type === k} onPress={() => setType(k)} />)}</Row>
      <Field label={`Distance (${dUnit(u)})`} value={dist} onChangeText={setDist} keyboardType="decimal-pad" />
      <Field label="Time (minutes)" value={mins} onChangeText={setMins} keyboardType="decimal-pad" />
      <Button title="Save" disabled={!num(mins)} onPress={() => {
        if (!profile) return;
        const d = num(dist) ?? 0;
        update((x) => { x.cardio.push({ id: uid(), profileId: profile.id, type, startedAt: Date.now() - (num(mins) ?? 0) * 60000, durationS: Math.round((num(mins) ?? 0) * 60), distanceM: Math.round(u === 'metric' ? d * 1000 : d * 1609.344), source: 'manual' }); });
        setDist(''); setMins(''); onClose();
      }} />
    </Sheet>
  );
}

export function Run({ type, steps, programmeId, dayIndex, routeTargetM }: { type: CardioType; steps?: IntervalStep[]; programmeId?: string; dayIndex?: number; routeTargetM?: number }) {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const [state, setState] = useState<'ready' | 'running' | 'paused'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [dist, setDist] = useState(0);
  const [gps, setGps] = useState<string>('Waiting for GPS…');
  const startedAt = useRef(0);
  const lastTick = useRef(0);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastStep = useRef(-1);
  const runningRef = useRef(false);
  const now = useNow(1000);

  useEffect(() => () => { sub.current?.remove(); keepAwake(false); }, []);

  useEffect(() => {
    if (state !== 'running') return;
    lastTick.current = Date.now();
    const i = setInterval(() => {
      const now = Date.now();
      setElapsed((e) => e + (now - lastTick.current) / 1000);
      lastTick.current = now;
    }, 500);
    return () => clearInterval(i);
  }, [state]);

  const at = steps?.length ? intervalAt(steps, elapsed) : undefined;
  useEffect(() => {
    if (!at || state !== 'running') return;
    if (at.index !== lastStep.current) {
      lastStep.current = at.index;
      speak(at.done ? 'Intervals done. Nice work.' : `${at.step.kind} for ${at.step.mins} minute${at.step.mins > 1 ? 's' : ''}`);
    }
  }, [at?.index, at?.done, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    startedAt.current = Date.now();
    setState('running');
    runningRef.current = true;
    keepAwake(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setGps('Location is off, so only time is recorded.');
      sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 2000 }, (loc) => {
        if (!runningRef.current) return;
        const p: GeoPoint = [loc.coords.latitude, loc.coords.longitude, loc.timestamp];
        setGps(`GPS ±${Math.round(loc.coords.accuracy ?? 0)} m`);
        setPoints((prev) => {
          const last = prev[prev.length - 1];
          if (!acceptFix(last, p, loc.coords.accuracy)) return prev;
          if (last) setDist((d) => d + haversine([last[0], last[1]], [p[0], p[1]]));
          return [...prev, p];
        });
      });
    } catch (e) {
      setGps(`No GPS here (${(e as Error).message}). Time is still recorded.`);
    }
  };
  const pause = () => { runningRef.current = false; setState('paused'); };
  const resume = () => { runningRef.current = true; setState('running'); };
  const end = () => {
    sub.current?.remove();
    keepAwake(false);
    if (!profile || elapsed < 10) return nav.back();
    const s: CardioSession = { id: uid(), profileId: profile.id, type, startedAt: startedAt.current, durationS: Math.round(elapsed), distanceM: Math.round(dist), source: 'gps', steps, points: points.filter((_, i) => i % 2 === 0 || i === points.length - 1), routeTargetM };
    update((d) => {
      d.cardio.push(s);
      if (programmeId) { const e = d.programmes[profile.id]; if (e?.programmeId === programmeId) e.nextDay = Math.max(e.nextDay, (dayIndex ?? 0) + 1); }
      const plan = d.plan.find((p) => p.profileId === profile.id && p.date === ymd() && p.kind === 'cardio' && !p.doneRef);
      if (plan) plan.doneRef = s.id;
    });
    nav.replace('cardioDetail', { id: s.id });
  };

  const recentPace = (() => {
    const cut = now - 60000;
    const recent = points.filter((p) => p[2] >= cut);
    if (recent.length < 2) return '–';
    let d = 0;
    for (let i = 1; i < recent.length; i++) d += haversine([recent[i - 1][0], recent[i - 1][1]], [recent[i][0], recent[i][1]]);
    return pace(d, (recent[recent.length - 1][2] - recent[0][2]) / 1000, u);
  })();
  const kg = profile ? latestWeight(data.readings, profile.id) : undefined;

  return (
    <Screen kicker={TYPE_LABEL[type]} title={state === 'ready' ? 'Ready when you are' : clock(elapsed)}>
      {at ? (
        <Card accent>
          <Row><Txt size={28} weight="700" color={t.accent} style={{ flex: 1, textTransform: 'capitalize' }}>{at.done ? 'Done' : at.step.kind}</Txt><Txt size={28} weight="700" mono>{at.done ? '' : `${clock(at.left)} left`}</Txt></Row>
          <ProgressBar pct={at.done ? 100 : (at.intoStep / (at.step.mins * 60)) * 100} />
          <Txt size={13} color={t.muted}>Step {at.index + 1} of {steps!.length}{steps![at.index + 1] ? ` · next: ${steps![at.index + 1].mins} min ${steps![at.index + 1].kind}` : ''}</Txt>
        </Card>
      ) : null}
      <Row wrap>
        <Stat label="Distance" value={`${round(distOut(dist, u), 2)} ${dUnit(u)}`} />
        <Stat label={routeTargetM ? 'Distance left' : 'Average pace'} value={routeTargetM ? `${round(distOut(Math.max(0, routeTargetM - dist), u), 2)} ${dUnit(u)}` : pace(dist, elapsed, u)} />
      </Row>
      <Row wrap>
        <Stat label="Pace now" value={recentPace} />
        <Stat label="Calories" value={kg ? `≈ ${kcal(MET[type], kg, elapsed)}` : '–'} sub={kg ? 'estimate' : 'add your weight in Body'} />
      </Row>
      <RouteSketch points={points} />
      <Txt size={13} color={t.muted}>{state === 'ready' ? 'DUO keeps the screen on while you run.' : gps}</Txt>
      {kg ? <Txt size={12} color={t.muted}>{MET_SOURCE}</Txt> : null}
      {state === 'ready' ? <Button title="Start" icon="play" onPress={start} /> : (
        <Row>
          {state === 'running' ? <Button flex kind="secondary" title="Pause" icon="pause" onPress={pause} /> : <Button flex kind="secondary" title="Resume" icon="play" onPress={resume} />}
          <Button flex title="End" onPress={end} />
        </Row>
      )}
    </Screen>
  );
}

export function CardioDetail({ id }: { id: string }) {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const c = data.cardio.find((x) => x.id === id);
  if (!c) return <Screen title="Cardio"><Empty title="Not found" /></Screen>;
  const kg = profile ? latestWeight(data.readings, profile.id) : undefined;
  const sameType = data.cardio.filter((x) => x.profileId === c.profileId && x.type === c.type && x.distanceM > 400);
  const bestPace = sameType.reduce((b, x) => Math.min(b, x.durationS / x.distanceM), Infinity);
  const isBest = c.distanceM > 400 && c.durationS / c.distanceM <= bestPace + 1e-9;
  const longest = Math.max(...sameType.map((x) => x.distanceM), 0);
  return (
    <Screen kicker={niceDate(c.startedAt)} title={TYPE_LABEL[c.type]}>
      {isBest && sameType.length > 1 ? <Notice tone="good">Fastest {TYPE_LABEL[c.type].toLowerCase()} pace yet</Notice> : null}
      {c.distanceM === longest && sameType.length > 1 ? <Notice tone="good">Longest {TYPE_LABEL[c.type].toLowerCase()} yet</Notice> : null}
      <Row wrap><Stat label="Distance" value={`${round(distOut(c.distanceM, u), 2)} ${dUnit(u)}`} /><Stat label="Time" value={clock(c.durationS)} /></Row>
      <Row wrap><Stat label="Pace" value={pace(c.distanceM, c.durationS, u)} /><Stat label="Calories" value={kg ? `≈ ${kcal(MET[c.type], kg, c.durationS)}` : '–'} sub="estimate" /></Row>
      {c.points?.length ? <Card><RouteSketch points={c.points} /></Card> : null}
      <Txt size={12} color={t.muted}>{c.source === 'gpx' ? 'Imported from a GPX file.' : c.source === 'manual' ? 'Logged by hand.' : 'Recorded with GPS in DUO.'} {kg ? MET_SOURCE : ''}</Txt>
      <Segmented value={c.type} onChange={(v) => update((d) => { const x = d.cardio.find((y) => y.id === id); if (x) x.type = v; })} options={(['walk', 'jog', 'run', 'cycle'] as CardioType[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))} />
      <Button kind="danger" title="Delete" onPress={() => { update((d) => { d.cardio = d.cardio.filter((x) => x.id !== id); }); nav.back(); }} />
      <View />
    </Screen>
  );
}
