/** Body tab: readings and trends, Fitdays screenshot import, photos, recovery map. */
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useStore } from '../core/store';
import type { MetricKey, MuscleGroup, Photo } from '../core/types';
import { lenIn, niceDate, num, round, uid, weightIn } from '../core/util';
import { changeOver, display, latest, METRICS, metricInfo, parseFitdays, plausible, rolling7, series, unitFor } from '../domain/body';
import { recovery } from '../domain/progress';
import { GROUP_LABEL } from '../domain/exercises';
import { Button, Card, Chip, Empty, Field, Label, ListItem, Notice, Row, Screen, Segmented, Sheet, Txt, useTheme } from '../ui/kit';
import { TrendChart } from '../ui/charts';
import { BodyMap } from '../ui/BodyMap';
import { useNav } from '../ui/nav';
import { ocrEngine, pickImage, recognizeText } from '../platform/device';

const toStored = (k: MetricKey, v: number, u: 'metric' | 'imperial') => {
  const m = metricInfo(k);
  return m.kind === 'weight' ? weightIn(v, u) : m.kind === 'length' ? lenIn(v, u) : v;
};

export function Body() {
  const [tab, setTab] = useState<'readings' | 'photos' | 'map'>('readings');
  return (
    <Screen title="Body">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'readings', label: 'Readings' }, { value: 'photos', label: 'Photos' }, { value: 'map', label: 'Recovery' }]} />
      {tab === 'readings' ? <Readings /> : tab === 'photos' ? <Photos /> : <Recovery />}
    </Screen>
  );
}

function Readings() {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const mine = data.readings.filter((r) => r.profileId === profile?.id);
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [adding, setAdding] = useState(false);
  const s = series(mine, metric);
  const avg = rolling7(s);
  const goal = data.goals.find((g) => g.profileId === profile?.id && g.metric === metric && !g.doneAt);
  const last = latest(mine, metric);
  const ch = changeOver(mine, metric, 30);
  const shown = METRICS.filter((m) => latest(mine, m.key));
  return (
    <>
      <Row wrap gap={6}>{METRICS.filter((m) => latest(mine, m.key) || ['weight', 'bodyFat', 'waist'].includes(m.key)).map((m) => <Chip key={m.key} label={m.label} on={metric === m.key} onPress={() => setMetric(m.key)} />)}</Row>
      <Card>
        <Label>{metricInfo(metric).label}{s.length > 1 ? ' · 7-day average' : ''}</Label>
        {last ? (
          <>
            <Txt size={34} weight="700" mono>{display(metric, avg[avg.length - 1].value, u)} {unitFor(metric, u)}</Txt>
            {ch != null ? <Txt size={14} color={(ch < 0) === ['weight', 'bodyFat', 'visceral', 'waist'].includes(metric) ? t.good : t.soft}>{ch > 0 ? '+' : ''}{display(metric, ch, u)} {unitFor(metric, u)} in 30 days</Txt> : null}
            <TrendChart raw={s.map((r) => display(metric, r.value, u))} avg={avg.map((r) => display(metric, r.value, u))} target={goal ? display(metric, goal.target, u) : undefined} />
            <Txt size={12} color={t.muted}>Last: {display(metric, last.value, u)} {unitFor(metric, u)} on {niceDate(last.at)} · {last.source === 'screenshot' ? 'from screenshot' : last.source}{metricInfo(metric).estimate ? ' · scale estimate' : ''}</Txt>
          </>
        ) : <Txt color={t.muted}>No {metricInfo(metric).label.toLowerCase()} readings yet.</Txt>}
      </Card>
      <Row>
        <Button flex title="Add reading" icon="plus" onPress={() => setAdding(true)} />
        <Button flex kind="secondary" title="Fitdays screenshot" icon="camera" onPress={() => nav.push('import')} />
      </Row>
      {shown.length ? <Label>Latest</Label> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((m) => {
          const r = latest(mine, m.key)!;
          return (
            <Pressable key={m.key} onPress={() => setMetric(m.key)} style={{ width: '48%', backgroundColor: t.card, borderRadius: 14, padding: 12, gap: 2 }}>
              <Txt size={12} color={t.muted}>{m.label}</Txt>
              <Txt size={19} weight="700">{display(m.key, r.value, u)} {unitFor(m.key, u)}</Txt>
              <Txt size={11} color={t.soft}>{r.source === 'screenshot' ? 'Screenshot' : r.source === 'health' ? 'Apple Health' : 'Manual'}{m.estimate ? ' · est.' : ''}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt size={12} color={t.muted}>Scale readings are estimates. Hydration changes them, so weigh at the same time each morning and watch the trend.</Txt>
      {s.length ? <Label>History</Label> : null}
      {[...s].reverse().slice(0, 12).map((r) => (
        <ListItem key={r.id} title={`${display(metric, r.value, u)} ${unitFor(metric, u)}`} sub={niceDate(r.at)} right={<Button small kind="ghost" title="Delete" onPress={() => update((d) => { d.readings = d.readings.filter((x) => x.id !== r.id); })} />} />
      ))}
      <AddReading key={metric} visible={adding} onClose={() => setAdding(false)} initial={metric} />
    </>
  );
}

function AddReading({ visible, onClose, initial }: { visible: boolean; onClose: () => void; initial: MetricKey }) {
  const { profile, update } = useStore();
  const u = profile?.units ?? 'metric';
  const [metric, setMetric] = useState<MetricKey>(initial);
  const [value, setValue] = useState('');
  const v = num(value);
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a reading">
      <Row wrap gap={6}>{METRICS.map((m) => <Chip key={m.key} label={m.label} on={metric === m.key} onPress={() => setMetric(m.key)} />)}</Row>
      <Field label={`${metricInfo(metric).label} (${unitFor(metric, u) || 'value'})`} value={value} onChangeText={setValue} keyboardType="decimal-pad" autoFocus />
      {v != null && !plausible(metric, toStored(metric, v, u)) ? <Notice tone="warn">That looks unusual for {metricInfo(metric).label.toLowerCase()}. Check it before saving.</Notice> : null}
      <Button title="Save" disabled={v == null} onPress={() => {
        if (!profile || v == null) return;
        update((d) => { d.readings.push({ id: uid(), profileId: profile.id, at: Date.now(), metric, value: toStored(metric, v, u), source: 'manual' }); });
        setValue(''); onClose();
      }} />
    </Sheet>
  );
}

export function ImportScreen() {
  const { profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const [stage, setStage] = useState<'pick' | 'reading' | 'review' | 'failed'>('pick');
  const [rows, setRows] = useState<{ metric: MetricKey; value: string; keep: boolean }[]>([]);
  const [err, setErr] = useState('');
  const [rawText, setRawText] = useState('');
  const go = async () => {
    setErr('');
    const img = await pickImage(2000);
    if (!img) return;
    setStage('reading');
    try {
      const text = await recognizeText(img);
      setRawText(text);
      const parsed = parseFitdays(text);
      if (!parsed.length) { setStage('failed'); return; }
      setRows(parsed.map((p) => ({ metric: p.metric, value: String(display(p.metric, p.value, u)), keep: plausible(p.metric, p.value) })));
      setStage('review');
    } catch (e) {
      setErr((e as Error).message);
      setStage('failed');
    }
  };
  const save = () => {
    if (!profile) return;
    const at = Date.now();
    update((d) => {
      for (const r of rows) {
        const v = num(r.value);
        if (r.keep && v != null) d.readings.push({ id: uid(), profileId: profile.id, at, metric: r.metric, value: toStored(r.metric, v, u), source: 'screenshot' });
      }
    });
    nav.back();
  };
  return (
    <Screen title="Fitdays screenshot">
      {stage === 'pick' ? (
        <>
          <Txt color={t.soft}>Take a screenshot of your Fitdays report, then pick it here. DUO reads the numbers on this phone and shows them to you before saving. The image isn’t kept.</Txt>
          <Button title="Pick screenshot" icon="camera" onPress={go} />
          <Txt size={12} color={t.muted}>{ocrEngine}. The first read downloads the text model from this site once (about 3 MB).</Txt>
        </>
      ) : null}
      {stage === 'reading' ? <Card><Txt>Reading the numbers…</Txt><Txt size={13} color={t.muted}>This can take 10–20 seconds the first time.</Txt></Card> : null}
      {stage === 'failed' ? (
        <>
          <Notice tone="warn">{err || 'Couldn’t find any readings in that image. Try a clearer screenshot, or add them by hand in Body.'}</Notice>
          {rawText ? <Card><Label>Text found</Label><Txt size={12} color={t.muted}>{rawText.slice(0, 600)}</Txt></Card> : null}
          <Button kind="secondary" title="Try another screenshot" onPress={() => setStage('pick')} />
        </>
      ) : null}
      {stage === 'review' ? (
        <>
          <Txt color={t.soft}>Check each value. Untick anything that’s wrong.</Txt>
          {rows.map((r, i) => {
            const v = num(r.value);
            const odd = v != null && !plausible(r.metric, toStored(r.metric, v, u));
            return (
              <Card key={r.metric}>
                <Row>
                  <Txt weight="600" style={{ flex: 1 }}>{metricInfo(r.metric).label}</Txt>
                  <Chip label={r.keep ? 'Save' : 'Skip'} on={r.keep} onPress={() => setRows((x) => x.map((y, j) => (j === i ? { ...y, keep: !y.keep } : y)))} />
                </Row>
                <Field value={r.value} onChangeText={(s) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: s } : y)))} suffix={unitFor(r.metric, u)} keyboardType="decimal-pad" />
                {odd ? <Txt size={12} color={t.warn}>This looks misread. Check it against the screenshot.</Txt> : null}
              </Card>
            );
          })}
          <Button title={`Save ${rows.filter((r) => r.keep).length} readings`} disabled={!rows.some((r) => r.keep)} onPress={save} />
        </>
      ) : null}
    </Screen>
  );
}

function PhotoThumb({ p, size, onPress, selected }: { p: Photo; size: number; onPress?: () => void; selected?: boolean }) {
  const { loadPhoto } = useStore();
  const t = useTheme();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { loadPhoto(p.id).then(setSrc); }, [p.id, loadPhoto]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${p.pose} photo ${niceDate(p.at)}`} onPress={onPress} style={{ width: size, gap: 4 }}>
      <View style={{ width: size, height: size * 1.33, borderRadius: 12, overflow: 'hidden', backgroundColor: t.raised, borderWidth: selected ? 2 : 0, borderColor: t.accent }}>
        {src ? <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      </View>
      <Txt size={11} color={t.muted}>{niceDate(p.at)} · {p.pose}</Txt>
    </Pressable>
  );
}

function Photos() {
  const { data, profile, update, savePhoto, photosReady, deletePhoto } = useStore();
  const nav = useNav();
  const t = useTheme();
  const [pose, setPose] = useState<Photo['pose']>('front');
  const [pick, setPick] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const mine = data.photos.filter((p) => p.profileId === profile?.id).sort((a, b) => b.at - a.at);
  const add = async () => {
    setErr('');
    const url = await pickImage();
    if (!url || !profile) return;
    const id = uid();
    try {
      await savePhoto(id, url);
      update((d) => { d.photos.push({ id, profileId: profile.id, at: Date.now(), pose }); });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  if (!data.settings.lockHash || !photosReady) {
    return (
      <Empty title="Photos need an app passcode" sub="Progress photos are encrypted with your passcode, so they can’t be seen without it."
        action={<Button small title="Set a passcode" onPress={() => nav.push('settings')} />} />
    );
  }
  const compare = mine.filter((p) => pick.includes(p.id));
  return (
    <>
      <Segmented value={pose} onChange={setPose} options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
      <Button title={`Add ${pose} photo`} icon="camera" onPress={add} />
      {err ? <Notice tone="warn">{err}</Notice> : null}
      <Txt size={12} color={t.muted}>Encrypted on this phone. Never synced. Tap two to compare.</Txt>
      {compare.length === 2 ? (
        <Card>
          <Row gap={8}>{compare.sort((a, b) => a.at - b.at).map((p) => <PhotoThumb key={p.id} p={p} size={146} />)}</Row>
          <Button small kind="secondary" title="Clear comparison" onPress={() => setPick([])} />
        </Card>
      ) : null}
      {mine.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {mine.map((p) => <PhotoThumb key={p.id} p={p} size={100} selected={pick.includes(p.id)} onPress={() => setPick((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x.slice(-1), p.id]))} />)}
        </View>
      ) : <Empty title="No photos yet" />}
      {pick.length === 1 ? <Button kind="danger" small title="Delete selected photo" onPress={() => { deletePhoto(pick[0]); setPick([]); }} /> : null}
    </>
  );
}

function Recovery() {
  const { data, profile } = useStore();
  const t = useTheme();
  const st = recovery(data.workouts.filter((w) => w.profileId === profile?.id));
  const groups = Object.keys(st) as MuscleGroup[];
  return (
    <>
      <Card><BodyMap status={st} sex={profile?.sex ?? 'male'} /></Card>
      <Row gap={14}>
        <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.good }} /><Txt size={12}>Ready</Txt></Row>
        <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8C26A' }} /><Txt size={12}>Under a day</Txt></Row>
        <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.warn }} /><Txt size={12}>Recovering</Txt></Row>
      </Row>
      {groups.map((g) => <ListItem key={g} title={GROUP_LABEL[g]} sub={st[g].last ? `Last trained ${niceDate(st[g].last!)}` : 'Not trained yet'} right={<Txt size={13} color={st[g].hoursLeft > 0 ? t.warn : t.good}>{st[g].hoursLeft > 0 ? `${round(st[g].hoursLeft, 0)} h left` : 'Ready'}</Txt>} />)}
      <Txt size={12} color={t.muted}>Rule-of-thumb recovery times after a hard session. Listen to your body over the numbers.</Txt>
    </>
  );
}
