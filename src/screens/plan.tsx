/** Plan tab: fitness calendar, goals, calendar reminders, streaks and badges. */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../core/store';
import type { Goal, GoalKind, MetricKey, PlanKind } from '../core/types';
import { addDays, DAYS, MONTHS, niceDate, num, parseYmd, uid, weekStart, ymd } from '../core/util';
import { goalProgress, onPace, badges, activeDays, weekStreak, dayStreak, thisWeekCount } from '../domain/progress';
import { display, metricInfo, unitFor } from '../domain/body';
import { buildIcs, type IcsEvent } from '../domain/ics';
import { EXERCISES, findExercise } from '../domain/exercises';
import { Button, Card, Chip, Empty, Field, IconButton, Label, ListItem, Notice, ProgressBar, Row, Screen, Segmented, Sheet, Stat, Txt, useTheme } from '../ui/kit';
import { Ring } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { useNav } from '../ui/nav';
import { saveFile } from '../platform/device';

const KIND_LABEL: Record<PlanKind, string> = { strength: 'Strength', cardio: 'Cardio', rest: 'Rest', measure: 'Weigh-in' };

export function Plan() {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState(ymd());
  const [adding, setAdding] = useState(false);
  const pid = profile?.id;
  const items = data.plan.filter((p) => p.profileId === pid);
  const doneDays = useMemo(() => {
    const m = new Map<string, Set<PlanKind>>();
    const add = (d: string, k: PlanKind) => m.set(d, new Set([...(m.get(d) ?? []), k]));
    data.workouts.filter((w) => w.profileId === pid && w.endedAt).forEach((w) => add(ymd(w.startedAt), 'strength'));
    data.cardio.filter((c) => c.profileId === pid).forEach((c) => add(ymd(c.startedAt), 'cardio'));
    data.readings.filter((r) => r.profileId === pid && r.metric === 'weight').forEach((r) => add(ymd(r.at), 'measure'));
    return m;
  }, [data.workouts, data.cardio, data.readings, pid]);
  const first = ymd(month);
  const lead = (month.getDay() + 6) % 7;
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(first, i))];
  const colors: Record<PlanKind, string> = { strength: t.accent, cardio: t.good, rest: t.muted, measure: t.warn };
  const dayItems = items.filter((p) => p.date === day).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const today = ymd();
  return (
    <Screen title="Plan" right={<IconButton icon="plus" label="Add to plan" onPress={() => setAdding(true)} />}>
      <Row>
        <IconButton icon="back" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <Txt size={18} weight="700" center style={{ flex: 1 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Txt>
        <IconButton icon="chevron" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </Row>
      <View style={{ flexDirection: 'row' }}>{DAYS.map((d) => <Txt key={d} size={12} color={t.muted} center style={{ flex: 1 }}>{d[0]}</Txt>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c, i) => {
          if (!c) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const done = doneDays.get(c);
          const planned = items.filter((p) => p.date === c);
          const sel = c === day;
          return (
            <Pressable key={c} accessibilityRole="button" accessibilityLabel={`${niceDate(c)}${done ? ', done' : ''}${planned.length ? `, ${planned.length} planned` : ''}`} onPress={() => setDay(c)}
              style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: sel ? t.raised : 'transparent', borderWidth: c === today ? 1 : 0, borderColor: t.accent }}>
              <Txt size={14} weight={c === today ? '700' : '500'} color={c > today ? t.muted : t.text}>{parseYmd(c).getDate()}</Txt>
              <View style={{ flexDirection: 'row', gap: 3, height: 7 }}>
                {[...(done ?? [])].map((k) => <View key={k} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors[k] }} />)}
                {planned.filter((p) => !p.doneRef && !done?.has(p.kind)).slice(0, 2).map((p) => <View key={p.id} style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: colors[p.kind] }} />)}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Row wrap gap={12}>{(Object.keys(KIND_LABEL) as PlanKind[]).map((k) => <Row key={k} gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[k] }} /><Txt size={12} color={t.soft}>{KIND_LABEL[k]}</Txt></Row>)}<Txt size={12} color={t.muted}>Ring = planned</Txt></Row>
      <Label>{niceDate(day)}{day === today ? ' · today' : ''}</Label>
      {dayItems.length ? dayItems.map((p) => (
        <ListItem key={p.id} title={p.title} sub={`${KIND_LABEL[p.kind]}${p.time ? ` · ${p.time}` : ''}${p.doneRef ? ' · done' : ''}`}
          right={<Button small kind="ghost" title="Remove" onPress={() => update((d) => { d.plan = d.plan.filter((x) => x.id !== p.id); })} />} />
      )) : <Txt color={t.muted}>Nothing planned.</Txt>}
      <ListItem icon="trophy" title="Goals" sub={`${data.goals.filter((g) => g.profileId === pid && !g.doneAt).length} active`} onPress={() => nav.push('goals')} />
      <ListItem icon="flame" title="Streaks and badges" sub="Weekly target, streaks, achievements" onPress={() => nav.push('progress')} />
      <ListItem icon="bell" title="Reminders" sub="Add your plan to Apple Calendar with alerts" onPress={() => nav.push('reminders')} />
      <AddPlan visible={adding} onClose={() => setAdding(false)} date={day} />
    </Screen>
  );
}

function AddPlan({ visible, onClose, date }: { visible: boolean; onClose: () => void; date: string }) {
  const { profile, update } = useStore();
  const [kind, setKind] = useState<PlanKind>('strength');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [weeks, setWeeks] = useState('1');
  return (
    <Sheet visible={visible} onClose={onClose} title={`Plan for ${niceDate(date)}`}>
      <Segmented value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as PlanKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder={kind === 'strength' ? 'Upper body' : kind === 'cardio' ? 'Walk / jog 5·5·5' : kind === 'measure' ? 'Weigh-in' : 'Rest day'} />
      <Field label="Time (optional, HH:MM)" value={time} onChangeText={setTime} placeholder="18:00" keyboardType="numbers-and-punctuation" />
      <Field label="Repeat for how many weeks" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />
      <Button title="Add" onPress={() => {
        if (!profile) return;
        const n = Math.max(1, Math.min(26, num(weeks) ?? 1));
        const okTime = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : undefined;
        update((d) => { for (let i = 0; i < n; i++) d.plan.push({ id: uid(), profileId: profile.id, date: addDays(date, i * 7), time: okTime, kind, title: title.trim() || KIND_LABEL[kind] }); });
        setTitle(''); setTime(''); setWeeks('1'); onClose();
      }} />
    </Sheet>
  );
}

const GOAL_TYPES: { kind: GoalKind; label: string; metric?: MetricKey }[] = [
  { kind: 'lose_weight', label: 'Lose weight', metric: 'weight' },
  { kind: 'gain_weight', label: 'Gain weight', metric: 'weight' },
  { kind: 'lose_fat', label: 'Lose body fat', metric: 'bodyFat' },
  { kind: 'gain_muscle', label: 'Gain muscle', metric: 'muscle' },
  { kind: 'tone', label: 'Trim a measurement', metric: 'waist' },
  { kind: 'lift', label: 'Lift target' },
  { kind: 'distance', label: 'Distance total' },
];

export function Goals() {
  const { data, profile, update } = useStore();
  const t = useTheme();
  const u = profile?.units ?? 'metric';
  const [adding, setAdding] = useState(false);
  const mine = data.goals.filter((g) => g.profileId === profile?.id);
  const fmt = (g: Goal, v: number) => (g.metric ? `${display(g.metric, v, u)} ${unitFor(g.metric, u)}` : g.kind === 'distance' ? `${v.toFixed(1)} km` : `${Math.round(v)} kg`);
  return (
    <Screen title="Goals" right={<IconButton icon="plus" label="New goal" onPress={() => setAdding(true)} />}>
      {mine.length ? mine.map((g) => {
        const { current, pct } = goalProgress(g, data.readings, data.workouts, data.cardio);
        const pace = onPace(g, pct);
        return (
          <Card key={g.id}>
            <Row gap={14}>
              <Ring pct={pct} size={72} />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt size={17} weight="700">{g.title}</Txt>
                <Txt size={13} color={t.soft}>{fmt(g, current)} now · target {fmt(g, g.target)}</Txt>
                <Txt size={13} color={g.doneAt ? t.good : pace === 'behind' ? t.warn : t.good}>{g.doneAt ? `Reached ${niceDate(g.doneAt)}` : `${pace} · by ${niceDate(g.deadline)}`}</Txt>
              </View>
            </Row>
            <Row>
              {!g.doneAt && pct >= 100 ? <Button small title="Mark reached" onPress={() => update((d) => { const x = d.goals.find((y) => y.id === g.id); if (x) x.doneAt = Date.now(); })} /> : null}
              <Button small kind="ghost" title="Delete" onPress={() => update((d) => { d.goals = d.goals.filter((x) => x.id !== g.id); })} />
            </Row>
          </Card>
        );
      }) : <Empty title="No goals yet" sub="Set a target and a date. Progress updates itself from your readings, lifts and runs." />}
      <AddGoal visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function AddGoal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, profile, update } = useStore();
  const u = profile?.units ?? 'metric';
  const [type, setType] = useState(GOAL_TYPES[0]);
  const [metric, setMetric] = useState<MetricKey>('waist');
  const [exerciseId, setExerciseId] = useState('bench');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState(addDays(ymd(), 90));
  const m = type.kind === 'tone' ? metric : type.metric;
  const mine = data.readings.filter((r) => r.profileId === profile?.id && r.metric === m).sort((a, b) => a.at - b.at);
  const startVal = m ? mine[mine.length - 1]?.value : 0;
  const unit = m ? unitFor(m, u) : type.kind === 'distance' ? 'km' : 'kg (est. 1-rep max)';
  return (
    <Sheet visible={visible} onClose={onClose} title="New goal">
      <Row wrap gap={6}>{GOAL_TYPES.map((g) => <Chip key={g.kind} label={g.label} on={type.kind === g.kind} onPress={() => setType(g)} />)}</Row>
      {type.kind === 'tone' ? <Row wrap gap={6}>{(['waist', 'hips', 'thigh', 'arm', 'chest'] as MetricKey[]).map((k) => <Chip key={k} label={metricInfo(k).label} on={metric === k} onPress={() => setMetric(k)} />)}</Row> : null}
      {type.kind === 'lift' ? <Row wrap gap={6}>{EXERCISES.filter((e) => e.kind === 'weight').slice(0, 12).map((e) => <Chip key={e.id} label={e.name} on={exerciseId === e.id} onPress={() => setExerciseId(e.id)} />)}</Row> : null}
      {m && startVal == null ? <Notice tone="warn">Add a {metricInfo(m).label.toLowerCase()} reading in Body first, so DUO knows where you’re starting.</Notice> : null}
      {m && startVal != null ? <Txt size={13}>Starting from {display(m, startVal, u)} {unit}</Txt> : null}
      <Field label={`Target (${unit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label="By (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />
      <Button title="Create goal" disabled={!num(target) || (!!m && startVal == null) || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)} onPress={() => {
        if (!profile) return;
        const tv = num(target)!;
        const stored = m ? (metricInfo(m).kind === 'weight' ? (u === 'metric' ? tv : tv * 0.45359237) : metricInfo(m).kind === 'length' ? (u === 'metric' ? tv : tv * 2.54) : tv) : tv;
        const ex = findExercise(exerciseId);
        const title = type.kind === 'lift' ? `${ex?.name} ${tv} kg` : type.kind === 'distance' ? `${tv} km in total` : `${type.kind === 'tone' ? metricInfo(m!).label : type.label}: ${tv} ${unit}`;
        update((d) => { d.goals.push({ id: uid(), profileId: profile.id, kind: type.kind, title, metric: m, exerciseId: type.kind === 'lift' ? exerciseId : undefined, start: startVal ?? 0, target: stored, deadline, createdAt: Date.now() }); });
        setTarget(''); onClose();
      }} />
    </Sheet>
  );
}

export function ProgressScreen() {
  const { data, profile } = useStore();
  const t = useTheme();
  const pid = profile?.id;
  const ws = data.workouts.filter((w) => w.profileId === pid);
  const cs = data.cardio.filter((c) => c.profileId === pid);
  const days = activeDays(ws, cs);
  const target = data.settings.weeklyTarget;
  const list = badges(ws, cs, data.readings.filter((r) => r.profileId === pid), data.goals.filter((g) => g.profileId === pid), target);
  const week = thisWeekCount(days);
  const ws0 = weekStart();
  return (
    <Screen title="Streaks and badges">
      <Card>
        <Label>This week</Label>
        <Txt size={28} weight="700">{week} of {target} active days</Txt>
        <ProgressBar pct={(week / target) * 100} />
        <Row>{DAYS.map((d, i) => { const on = days.has(addDays(ws0, i)); return <View key={d} style={{ flex: 1, alignItems: 'center', gap: 4 }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? t.accent : t.raised, alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon name="check" size={16} color={t.onAccent} /> : null}</View><Txt size={11} color={t.muted}>{d[0]}</Txt></View>; })}</Row>
      </Card>
      <Row><Stat label="Weeks on target" value={String(weekStreak(days, target))} /><Stat label="Day streak" value={String(dayStreak(days))} /></Row>
      <Label>Badges · {list.filter((b) => b.earned).length} of {list.length}</Label>
      {list.map((b) => <ListItem key={b.id} icon={b.earned ? 'trophy' : 'star'} iconColor={b.earned ? t.accent : t.muted} title={b.title} sub={b.detail} right={b.earned ? <Txt size={13} color={t.good}>Earned</Txt> : undefined} />)}
    </Screen>
  );
}

export function Reminders() {
  const { data, profile } = useStore();
  const t = useTheme();
  const [weighIn, setWeighIn] = useState('07:00');
  const [msg, setMsg] = useState('');
  const upcoming = data.plan.filter((p) => p.profileId === profile?.id && p.date >= ymd() && p.date <= addDays(ymd(), 28) && p.time && !p.doneRef);
  const exportIcs = async () => {
    const events: IcsEvent[] = upcoming.map((p) => ({ uid: p.id, title: `DUO: ${p.title}`, date: p.date, time: p.time, alarmMinutesBefore: 15 }));
    if (/^\d{1,2}:\d{2}$/.test(weighIn)) events.push({ uid: `weigh-${profile?.id}`, title: 'DUO: weigh-in', date: addDays(ymd(), 1), time: weighIn.padStart(5, '0'), alarmMinutesBefore: 0, repeatWeekly: true });
    const r = await saveFile('duo-reminders.ics', buildIcs(events), 'text/calendar');
    setMsg(r === 'failed' ? 'Couldn’t open the file here. In the installed app this opens Apple Calendar.' : 'Open the file and tap Add All. Calendar then reminds you on your lock screen.');
  };
  return (
    <Screen title="Reminders">
      <Txt color={t.soft}>DUO adds reminders to Apple Calendar, so they arrive as normal lock-screen alerts. No server is involved, and only the titles you see here are included.</Txt>
      <Card>
        <Label>Planned with a time (next 4 weeks)</Label>
        {upcoming.length ? upcoming.slice(0, 12).map((p) => <Txt key={p.id} size={14}>{niceDate(p.date)} {p.time} · {p.title}</Txt>) : <Txt color={t.muted}>Nothing with a time yet. Add times to plan items to get reminders for them.</Txt>}
      </Card>
      <Field label="Weekly weigh-in reminder (HH:MM, blank for none)" value={weighIn} onChangeText={setWeighIn} />
      <Button title="Add to Apple Calendar" icon="calendar" disabled={!upcoming.length && !/^\d{1,2}:\d{2}$/.test(weighIn)} onPress={exportIcs} />
      {msg ? <Notice>{msg}</Notice> : null}
      <Txt size={12} color={t.muted}>Change the plan later? Export again: events update instead of duplicating.</Txt>
    </Screen>
  );
}

