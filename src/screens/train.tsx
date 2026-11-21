/** Train tab: start/resume workouts, live logging, programmes, plates, exercise library. */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../core/store';
import type { Workout, WorkoutSet } from '../core/types';
import { clock, fmtWeight, niceDate, num, round, uid, weightIn, weightOut, wUnit, ymd } from '../core/util';
import { EXERCISES, findExercise, GROUP_LABEL } from '../domain/exercises';
import { bests, isPr, platesPerSide, prHint, prsInWorkout, suggestNext, volume, warmups } from '../domain/training';
import { findProgramme, programmeDay, PROGRAMMES } from '../domain/programmes';
import { kcal, MET, MET_SOURCE } from '../domain/cardio';
import { latestWeight } from '../domain/progress';
import { Button, Card, Chip, Empty, Field, IconButton, Label, ListItem, Notice, NumBox, Row, Screen, Segmented, Sheet, Stat, Txt, useNow, useTheme } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { useNav } from '../ui/nav';

function useMine() {
  const { data, profile } = useStore();
  const pid = profile?.id;
  return useMemo(() => ({
    workouts: data.workouts.filter((w) => w.profileId === pid),
    cardio: data.cardio.filter((c) => c.profileId === pid),
  }), [data.workouts, data.cardio, pid]);
}

/** Create a workout (optionally from a programme day) and open it. */
export function useStartWorkout() {
  const { update, profile, data } = useStore();
  const nav = useNav();
  return (opts?: { programmeId?: string; dayIndex?: number }) => {
    if (!profile) return;
    const p = findProgramme(opts?.programmeId);
    const day = p && opts?.dayIndex != null ? programmeDay(p, opts.dayIndex) : undefined;
    const history = data.workouts.filter((w) => w.profileId === profile.id && w.endedAt);
    const w: Workout = {
      id: uid(), profileId: profile.id, name: day?.title ?? 'Workout', startedAt: Date.now(), programmeId: p?.id, dayIndex: opts?.dayIndex,
      entries: (day?.exercises ?? []).map((ex) => {
        const lastEntry = [...history].reverse().flatMap((h) => h.entries).find((e) => e.exerciseId === ex.id);
        const lower = ['legs', 'glutes'].includes(findExercise(ex.id)?.group ?? '');
        const kg = lastEntry ? suggestNext(lastEntry.sets, ex.reps, lower) : undefined;
        return { exerciseId: ex.id, sets: Array.from({ length: ex.sets }, () => ({ kg, reps: ex.secs ? undefined : ex.reps, secs: ex.secs, done: false })) };
      }),
    };
    update((d) => { d.workouts.push(w); });
    nav.push('workout', { id: w.id });
  };
}

export function Train() {
  const { data, profile } = useStore();
  const nav = useNav();
  const t = useTheme();
  const start = useStartWorkout();
  const now = useNow(30000);
  const { workouts } = useMine();
  const active = workouts.find((w) => !w.endedAt);
  const done = workouts.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt);
  const enrol = profile ? data.programmes[profile.id] : undefined;
  const prog = findProgramme(enrol?.programmeId);
  const next = prog && enrol ? programmeDay(prog, enrol.nextDay) : undefined;
  const u = profile?.units ?? 'metric';
  return (
    <Screen title="Train">
      {active ? (
        <Card accent onPress={() => nav.push('workout', { id: active.id })}>
          <Label>In progress</Label>
          <Txt size={18} weight="700">{active.name}</Txt>
          <Txt color={t.soft}>Started {clock((now - active.startedAt) / 1000)} ago · tap to carry on</Txt>
        </Card>
      ) : null}
      {prog && next ? (
        <Card>
          <Label>{prog.name}</Label>
          <Txt size={18} weight="700">{next.title}</Txt>
          <Txt size={14} color={t.soft}>{next.kind === 'strength' ? next.exercises?.map((e) => findExercise(e.id)?.name).join(' · ') : 'Walk/jog intervals'}</Txt>
          <Button title={next.kind === 'strength' ? 'Start this session' : 'Start this run'} icon="play"
            onPress={() => (next.kind === 'strength' ? start({ programmeId: prog.id, dayIndex: enrol!.nextDay }) : nav.push('run', { type: 'intervals', steps: next.steps, programmeId: prog.id, dayIndex: enrol!.nextDay }))} />
        </Card>
      ) : null}
      <Row>
        <Button flex title="Empty workout" icon="plus" kind={prog ? 'secondary' : 'primary'} onPress={() => start()} />
        <Button flex title="Cardio" icon="run" kind="secondary" onPress={() => nav.push('cardio')} />
      </Row>
      <ListItem icon="star" title="Programmes" sub={prog ? `Following: ${prog.name}` : 'Ready-made plans for gym, home and running'} onPress={() => nav.push('programmes')} />
      <ListItem icon="dumbbell" title="Exercises" sub={`${EXERCISES.length + data.customExercises.length} with form cues and your records`} onPress={() => nav.push('exercises')} />
      <ListItem icon="scale" title="Plate calculator" sub="What to put on each side of the bar" onPress={() => nav.push('plates')} />
      <Label>History</Label>
      {done.length ? done.slice(0, 25).map((w) => {
        const prs = prsInWorkout(w, workouts).length;
        return <ListItem key={w.id} title={w.name} sub={`${niceDate(w.startedAt)} · ${Math.round(((w.endedAt ?? 0) - w.startedAt) / 60000)} min · ${fmtWeight(volume(w), u, 0)} lifted${prs ? ` · ${prs} PR${prs > 1 ? 's' : ''}` : ''}`} onPress={() => nav.push('workout', { id: w.id })} />;
      }) : <Empty title="No workouts yet" sub="Start an empty workout or pick a programme." />}
    </Screen>
  );
}

function RestTimer({ until, onAdd, onSkip }: { until: number; onAdd: (s: number) => void; onSkip: () => void }) {
  const t = useTheme();
  const now = useNow(250);
  const left = Math.max(0, (until - now) / 1000);
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, right: 12, bottom: 96, backgroundColor: t.raised, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: left ? t.accent : t.good }}>
      <Icon name="timer" color={t.accent} />
      <Txt size={26} weight="700" mono style={{ flex: 1 }}>{left ? clock(left) : 'Go!'}</Txt>
      <Button small kind="secondary" title="−15" onPress={() => onAdd(-15)} />
      <Button small kind="secondary" title="+15" onPress={() => onAdd(15)} />
      <Button small kind="secondary" title={left ? 'Skip' : 'Done'} onPress={onSkip} />
    </View>
  );
}

export function WorkoutScreen({ id }: { id: string }) {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const w = data.workouts.find((x) => x.id === id);
  const u = profile?.units ?? 'metric';
  const [picker, setPicker] = useState(false);
  const [restUntil, setRestUntil] = useState<number>();
  const [summary, setSummary] = useState(false);
  const now = useNow(1000);
  const history = useMemo(() => data.workouts.filter((x) => x.profileId === profile?.id && x.endedAt && x.id !== id), [data.workouts, profile?.id, id]);
  const best = useMemo(() => bests(history), [history]);
  if (!w) return <Screen title="Workout"><Empty title="This workout was deleted" /></Screen>;
  const finished = !!w.endedAt;
  const edit = (fn: (x: Workout) => void) => update((d) => { const x = d.workouts.find((y) => y.id === id); if (x) fn(x); });
  const lastSets = (exId: string) => [...history].reverse().flatMap((h) => h.entries).find((e) => e.exerciseId === exId)?.sets.filter((s) => !s.warmup) ?? [];

  const toggleDone = (ei: number, si: number) => {
    const becomesDone = !w.entries[ei].sets[si].done;
    edit((x) => { const s = x.entries[ei].sets[si]; s.done = !s.done; });
    if (becomesDone && !finished) setRestUntil(Date.now() + data.settings.restSeconds * 1000);
  };
  const finish = () => {
    edit((x) => { x.endedAt = Date.now(); x.entries = x.entries.filter((e) => e.sets.some((s) => s.done)); });
    update((d) => {
      if (w.programmeId && profile) {
        const enrol = d.programmes[profile.id];
        if (enrol?.programmeId === w.programmeId) enrol.nextDay = Math.max(enrol.nextDay, (w.dayIndex ?? 0) + 1);
      }
      const plan = d.plan.find((p) => p.profileId === profile?.id && p.date === ymd() && p.kind === 'strength' && !p.doneRef);
      if (plan) plan.doneRef = id;
    });
    setRestUntil(undefined);
    setSummary(true);
  };
  const prs = finished ? prsInWorkout(w, [...history, w]) : [];
  const kg = profile ? latestWeight(data.readings, profile.id) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen kicker={finished ? niceDate(w.startedAt) : `${clock((now - w.startedAt) / 1000)} elapsed`} title={w.name}
        right={!finished ? <Button small title="Finish" onPress={finish} disabled={!w.entries.some((e) => e.sets.some((s) => s.done))} /> : undefined}>
        {!finished ? <Field value={w.name} onChangeText={(v) => edit((x) => { x.name = v; })} label="Name" /> : null}
        {w.entries.map((e, ei) => {
          const ex = findExercise(e.exerciseId, data.customExercises);
          const prev = lastSets(e.exerciseId);
          const nextSet = e.sets.find((s) => !s.done && !s.warmup);
          const hint = ex?.kind === 'weight' ? prHint(best[e.exerciseId], nextSet?.kg) : undefined;
          const timed = ex?.kind === 'time';
          return (
            <Card key={`${e.exerciseId}-${ei}`}>
              <Row>
                <Pressable style={{ flex: 1 }} onPress={() => nav.push('exercise', { id: e.exerciseId })}>
                  <Txt size={18} weight="700">{ex?.name ?? e.exerciseId}</Txt>
                  <Txt size={13} color={t.muted}>{ex ? GROUP_LABEL[ex.group] : ''} · form cues ›</Txt>
                </Pressable>
                {!finished ? <IconButton icon="trash" label={`Remove ${ex?.name}`} onPress={() => edit((x) => { x.entries.splice(ei, 1); })} /> : null}
              </Row>
              {hint && !finished ? <Notice>{hint}</Notice> : null}
              <Row gap={8}>
                <Txt size={12} color={t.muted} style={{ width: 28 }}>Set</Txt>
                <Txt size={12} color={t.muted} style={{ flex: 1 }}>Last time</Txt>
                {!timed && ex?.kind === 'weight' ? <Txt size={12} color={t.muted} style={{ width: 64, textAlign: 'right' }}>{wUnit(u)}</Txt> : null}
                <Txt size={12} color={t.muted} style={{ width: 56, textAlign: 'right' }}>{timed ? 'secs' : 'reps'}</Txt>
                <View style={{ width: 40 }} />
              </Row>
              {e.sets.map((s, si) => {
                const pr = finished && isPr(s, best[e.exerciseId]);
                const p = prev[si - e.sets.slice(0, si).filter((x) => x.warmup).length];
                return (
                  <Row key={si} gap={8}>
                    <Txt size={14} color={s.warmup ? t.muted : t.text} style={{ width: 28 }}>{s.warmup ? 'W' : si + 1 - e.sets.slice(0, si).filter((x) => x.warmup).length}</Txt>
                    <Txt size={13} color={t.muted} style={{ flex: 1 }}>{p ? (timed ? `${p.secs ?? 0}s` : `${p.kg ? round(weightOut(p.kg, u)) : 'BW'} × ${p.reps ?? 0}`) : '–'}{pr ? '  ★ PR' : ''}</Txt>
                    {!timed && ex?.kind === 'weight' ? (
                      <NumBox label={`Weight set ${si + 1}`} value={s.kg != null ? String(round(weightOut(s.kg, u), 2)) : ''} onChange={(v) => edit((x) => { x.entries[ei].sets[si].kg = num(v) != null ? weightIn(num(v)!, u) : undefined; })} />
                    ) : null}
                    <NumBox width={56} label={`${timed ? 'Seconds' : 'Reps'} set ${si + 1}`} value={String((timed ? s.secs : s.reps) ?? '')} highlight={!s.done && s === nextSet}
                      onChange={(v) => edit((x) => { const set = x.entries[ei].sets[si]; if (timed) set.secs = num(v); else set.reps = num(v); })} />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={`Set ${si + 1} done`} onPress={() => toggleDone(ei, si)}
                      style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: s.done ? t.good : t.accent, backgroundColor: s.done ? t.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {s.done ? <Icon name="check" color={t.bg} size={20} /> : null}
                    </Pressable>
                  </Row>
                );
              })}
              {!finished ? (
                <Row wrap>
                  <Button small kind="secondary" title="Add set" icon="plus" onPress={() => edit((x) => { const last = x.entries[ei].sets.filter((z) => !z.warmup).slice(-1)[0]; x.entries[ei].sets.push({ kg: last?.kg, reps: last?.reps, secs: last?.secs, done: false }); })} />
                  {ex?.kind === 'weight' && !e.sets.some((s) => s.warmup) && (nextSet?.kg ?? 0) > data.settings.barKg ? (
                    <Button small kind="ghost" title="Add warm-up sets" onPress={() => edit((x) => { x.entries[ei].sets.unshift(...warmups(nextSet!.kg!, data.settings.barKg)); })} />
                  ) : null}
                </Row>
              ) : null}
            </Card>
          );
        })}
        {!finished ? <Button kind="secondary" title="Add exercise" icon="plus" onPress={() => setPicker(true)} /> : null}
        {finished ? (
          <Card>
            <Row><Stat label="Volume" value={fmtWeight(volume(w), u, 0)} /><Stat label="PRs" value={String(prs.length)} /></Row>
            {kg ? <Txt size={13} color={t.muted}>≈ {kcal(MET.strength, kg, ((w.endedAt ?? 0) - w.startedAt) / 1000)} kcal · {MET_SOURCE}</Txt> : null}
            <Button kind="danger" title="Delete this workout" onPress={() => { update((d) => { d.workouts = d.workouts.filter((x) => x.id !== id); }); nav.back(); }} />
          </Card>
        ) : null}
        <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={(exId) => {
          const ex = findExercise(exId, data.customExercises);
          const prevSets = lastSets(exId);
          edit((x) => { x.entries.push({ exerciseId: exId, sets: (prevSets.length ? prevSets : [{ done: false } as WorkoutSet, { done: false }, { done: false }]).map((s) => ({ kg: s.kg, reps: s.reps ?? (ex?.kind === 'time' ? undefined : 10), secs: ex?.kind === 'time' ? (s.secs ?? 30) : undefined, done: false })) }); });
          setPicker(false);
        }} />
      </Screen>
      {restUntil ? <RestTimer until={restUntil} onAdd={(s) => setRestUntil((r) => (r ?? Date.now()) + s * 1000)} onSkip={() => setRestUntil(undefined)} /> : null}
      <Sheet visible={summary} onClose={() => { setSummary(false); nav.back(); }} title="Workout done">
        <Txt size={18} weight="700">{w.name}</Txt>
        <Txt color={t.soft}>{Math.round(((w.endedAt ?? now) - w.startedAt) / 60000)} minutes · {fmtWeight(volume(w), u, 0)} lifted</Txt>
        {prs.length ? <Notice tone="good">{`New records: ${prs.map((p) => findExercise(p, data.customExercises)?.name).join(', ')}`}</Notice> : <Txt color={t.muted}>No new records this time. Consistency is what counts.</Txt>}
        <Button title="Done" onPress={() => { setSummary(false); nav.back(); }} />
      </Sheet>
    </View>
  );
}

function ExercisePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const { data, update } = useStore();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('all');
  const all = [...EXERCISES, ...data.customExercises];
  const list = all.filter((e) => (group === 'all' || e.group === group) && e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet visible={visible} onClose={onClose} title="Add exercise">
      <Field value={q} onChangeText={setQ} placeholder="Search" />
      <Row wrap gap={6}>
        <Chip label="All" on={group === 'all'} onPress={() => setGroup('all')} />
        {Object.entries(GROUP_LABEL).map(([g, l]) => <Chip key={g} label={l} on={group === g} onPress={() => setGroup(g)} />)}
      </Row>
      {list.map((e) => <ListItem key={e.id} title={e.name} sub={`${GROUP_LABEL[e.group]} · ${e.equipment}`} onPress={() => onPick(e.id)} />)}
      {q.trim() && !list.length ? (
        <Button kind="secondary" title={`Create "${q.trim()}"`} onPress={() => {
          const id = `custom-${uid()}`;
          update((d) => { d.customExercises.push({ id, name: q.trim(), group: group === 'all' ? 'core' : (group as never), equipment: 'bodyweight', kind: 'weight', cues: [], custom: true }); });
          onPick(id);
        }} />
      ) : null}
    </Sheet>
  );
}

export function Exercises() {
  const { data } = useStore();
  const nav = useNav();
  const [group, setGroup] = useState('all');
  const all = [...EXERCISES, ...data.customExercises];
  return (
    <Screen title="Exercises">
      <Row wrap gap={6}>
        <Chip label="All" on={group === 'all'} onPress={() => setGroup('all')} />
        {Object.entries(GROUP_LABEL).map(([g, l]) => <Chip key={g} label={l} on={group === g} onPress={() => setGroup(g)} />)}
      </Row>
      {all.filter((e) => group === 'all' || e.group === group).map((e) => <ListItem key={e.id} title={e.name} sub={`${GROUP_LABEL[e.group]} · ${e.equipment}`} onPress={() => nav.push('exercise', { id: e.id })} />)}
    </Screen>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const { data, profile } = useStore();
  const t = useTheme();
  const ex = findExercise(id, data.customExercises);
  const { workouts } = useMine();
  const u = profile?.units ?? 'metric';
  const b = bests(workouts)[id];
  const sessions = workouts.filter((w) => w.endedAt && w.entries.some((e) => e.exerciseId === id)).sort((a, z) => z.startedAt - a.startedAt);
  if (!ex) return <Screen title="Exercise"><Empty title="Not found" /></Screen>;
  return (
    <Screen kicker={GROUP_LABEL[ex.group]} title={ex.name}>
      <Card>
        <Label>Form cues</Label>
        {ex.cues.length ? ex.cues.map((c) => <Txt key={c}>• {c}</Txt>) : <Txt color={t.muted}>No cues for custom exercises yet.</Txt>}
      </Card>
      {b ? (
        <Row>
          {ex.kind === 'time' ? <Stat label="Longest" value={`${b.secs}s`} /> : <Stat label="Best set" value={b.kg ? `${round(weightOut(b.kg, u))} × ${b.reps}` : `${b.reps} reps`} sub={b.kg ? `${wUnit(u)} · ${niceDate(b.at)}` : niceDate(b.at)} />}
          {b.kg ? <Stat label="Est. 1-rep max" value={`${round(weightOut(b.e1rm, u))}`} sub={`${wUnit(u)} · estimate`} /> : null}
        </Row>
      ) : <Empty title="No records yet" sub="Your best sets show up here." />}
      {sessions.slice(0, 12).map((w) => (
        <ListItem key={w.id} title={niceDate(w.startedAt)} sub={w.entries.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup)).map((s) => (ex.kind === 'time' ? `${s.secs}s` : `${s.kg ? round(weightOut(s.kg, u)) : 'BW'}×${s.reps}`)).join('  ')} />
      ))}
    </Screen>
  );
}

export function Programmes() {
  const { data, profile, update } = useStore();
  const t = useTheme();
  const enrol = profile ? data.programmes[profile.id] : undefined;
  return (
    <Screen title="Programmes">
      <Txt color={t.soft}>Pick one to follow. DUO lines up the next session and suggests weights from last time.</Txt>
      {PROGRAMMES.map((p) => {
        const on = enrol?.programmeId === p.id;
        return (
          <Card key={p.id} accent={on}>
            <Row><Txt size={18} weight="700" style={{ flex: 1 }}>{p.name}</Txt><Txt size={13} color={t.muted}>{p.daysPerWeek}× a week · {p.where}</Txt></Row>
            <Txt size={14} color={t.soft}>{p.blurb}</Txt>
            {on ? <Txt size={13} color={t.accent}>Following · next: {programmeDay(p, enrol!.nextDay)?.title ?? 'finished'}</Txt> : null}
            <Row>
              {on ? (
                <>
                  <Button small kind="secondary" title="Restart" onPress={() => update((d) => { d.programmes[profile!.id] = { programmeId: p.id, startedOn: ymd(), nextDay: 0 }; })} />
                  <Button small kind="ghost" title="Stop following" onPress={() => update((d) => { d.programmes[profile!.id] = undefined; })} />
                </>
              ) : (
                <Button small title="Follow this" onPress={() => update((d) => { d.programmes[profile!.id] = { programmeId: p.id, startedOn: ymd(), nextDay: 0 }; })} />
              )}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}

export function Plates() {
  const { data, profile, update } = useStore();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const [target, setTarget] = useState('100');
  const s = data.settings;
  const kgTarget = weightIn(num(target) ?? 0, u);
  const r = platesPerSide(kgTarget, s.barKg, s.plates);
  return (
    <Screen title="Plate calculator">
      <Field label={`Target weight (${wUnit(u)})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Card>
        <Label>Each side of a {fmtWeight(s.barKg, u)} bar</Label>
        {kgTarget <= s.barKg ? <Txt color={t.muted}>Just the bar.</Txt> : (
          <Row wrap gap={6}>
            {r.plates.map((p, i) => <View key={i} style={{ minWidth: 52, height: 64 - i * 2, borderRadius: 8, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Txt weight="700" color={t.onAccent}>{round(weightOut(p, u), 2)}</Txt></View>)}
          </Row>
        )}
        {r.leftover > 0 ? <Notice tone="warn">{`Can’t make it exactly: ${round(weightOut(r.leftover * 2, u), 2)} ${wUnit(u)} short with your plates.`}</Notice> : null}
      </Card>
      <Field label="Plates you have (kg, comma separated)" value={s.plates.join(', ')} onChangeText={(v) => update((d) => { d.settings.plates = v.split(',').map((x) => num(x)).filter((x): x is number => !!x && x > 0); })} />
      <Segmented value={String(s.barKg)} onChange={(v) => update((d) => { d.settings.barKg = Number(v); })} options={[{ value: '20', label: '20 kg bar' }, { value: '15', label: '15 kg bar' }, { value: '10', label: '10 kg bar' }]} />
    </Screen>
  );
}
