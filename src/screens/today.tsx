/** Today: greeting, weekly target, main goal, today’s plan, recovery, partner. */
import { View } from 'react-native';
import { useStore } from '../core/store';
import type { MuscleGroup } from '../core/types';
import { niceDate, ymd } from '../core/util';
import { findExercise, GROUP_LABEL } from '../domain/exercises';
import { findProgramme, programmeDay } from '../domain/programmes';
import { activeDays, dayStreak, goalProgress, onPace, recovery, thisWeekCount } from '../domain/progress';
import { display, unitFor } from '../domain/body';
import { Button, Card, IconButton, Label, ListItem, Notice, ProgressBar, Row, Screen, Txt, useNow, useTheme } from '../ui/kit';
import { Ring } from '../ui/charts';
import { useNav } from '../ui/nav';
import { useStartWorkout } from './train';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

export function Today() {
  const { data, profile, update } = useStore();
  const nav = useNav();
  const t = useTheme();
  const start = useStartWorkout();
  const now = useNow(60000);
  if (!profile) return null;
  const u = profile.units;
  const ws = data.workouts.filter((w) => w.profileId === profile.id);
  const cs = data.cardio.filter((c) => c.profileId === profile.id);
  const days = activeDays(ws, cs);
  const week = thisWeekCount(days);
  const target = data.settings.weeklyTarget;
  const streak = dayStreak(days);
  const goal = data.goals.find((g) => g.profileId === profile.id && !g.doneAt);
  const gp = goal ? goalProgress(goal, data.readings, data.workouts, data.cardio) : undefined;
  const todayPlan = data.plan.filter((p) => p.profileId === profile.id && p.date === ymd());
  const enrol = data.programmes[profile.id];
  const prog = findProgramme(enrol?.programmeId);
  const next = prog && enrol ? programmeDay(prog, enrol.nextDay) : undefined;
  const active = ws.find((w) => !w.endedAt);
  const rec = recovery(ws);
  const groups = (Object.keys(rec) as MuscleGroup[]).sort((a, b) => rec[b].hoursLeft - rec[a].hoursLeft).slice(0, 3);
  const unseen = data.cheers.filter((c) => !c.seen);
  const partner = data.partner;

  return (
    <Screen kicker={niceDate(now)} title={`${greeting()}, ${profile.name}`} right={<IconButton icon="settings" label="Settings" onPress={() => nav.push('settings')} />}>
      {unseen.length ? (
        <Card accent onPress={() => update((d) => { d.cheers.forEach((c) => { c.seen = true; }); })}>
          <Label>From {unseen[unseen.length - 1].from}</Label>
          <Txt size={17} weight="600">{unseen[unseen.length - 1].text}</Txt>
          <Txt size={12} color={t.muted}>Tap to dismiss{unseen.length > 1 ? ` · ${unseen.length} new` : ''}</Txt>
        </Card>
      ) : null}

      {active ? (
        <Card accent onPress={() => nav.setTab('train')}>
          <Txt weight="700">{active.name} in progress</Txt>
          <Txt size={13} color={t.soft}>Go to Train to carry on</Txt>
        </Card>
      ) : null}

      <Card onPress={() => nav.push('progress')}>
        <Row>
          <View style={{ flex: 1, gap: 4 }}>
            <Label>This week</Label>
            <Txt size={20} weight="700">{week} of {target} active days</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt size={20} weight="700" color={t.accent}>{streak}</Txt>
            <Txt size={12} color={t.muted}>day streak</Txt>
          </View>
        </Row>
        <ProgressBar pct={(week / target) * 100} />
      </Card>

      {goal && gp ? (
        <Card onPress={() => nav.setTab('plan')}>
          <Row gap={16}>
            <Ring pct={gp.pct} />
            <View style={{ flex: 1, gap: 4 }}>
              <Label>Goal</Label>
              <Txt size={17} weight="700">{goal.title}</Txt>
              {goal.metric ? <Txt size={14} color={t.soft}>{display(goal.metric, Math.abs(goal.target - gp.current), u)} {unitFor(goal.metric, u)} to go · {onPace(goal, gp.pct)}</Txt> : <Txt size={14} color={t.soft}>{onPace(goal, gp.pct)}</Txt>}
            </View>
          </Row>
        </Card>
      ) : (
        <ListItem icon="trophy" title="Set a goal" sub="Lose weight, gain muscle, lift more, run further" onPress={() => { nav.setTab('plan'); }} />
      )}

      <Label>Today</Label>
      {next && !active ? (
        <Card>
          <Txt size={13} color={t.muted}>{prog!.name}</Txt>
          <Txt size={17} weight="700">{next.title}</Txt>
          <Txt size={13} color={t.soft}>{next.kind === 'strength' ? next.exercises?.map((e) => findExercise(e.id)?.name).join(' · ') : `${next.steps?.map((s) => `${s.mins} ${s.kind}`).join(', ')}`}</Txt>
          <Button small title="Start" icon="play" onPress={() => (next.kind === 'strength' ? start({ programmeId: prog!.id, dayIndex: enrol!.nextDay }) : nav.push('run', { type: 'intervals', steps: next.steps, programmeId: prog!.id, dayIndex: enrol!.nextDay }))} />
        </Card>
      ) : null}
      {todayPlan.map((p) => <ListItem key={p.id} icon={p.kind === 'cardio' ? 'run' : p.kind === 'measure' ? 'scale' : p.kind === 'rest' ? 'heart' : 'dumbbell'} title={p.title} sub={`${p.time ?? 'Any time'}${p.doneRef ? ' · done' : ''}`} />)}
      {!next && !todayPlan.length ? <Txt color={t.muted}>Nothing planned. Start something, or follow a programme from Train.</Txt> : null}
      <Row>
        <Button flex small kind="secondary" title="Workout" icon="dumbbell" onPress={() => start()} />
        <Button flex small kind="secondary" title="Run" icon="run" onPress={() => nav.push('run', { type: 'run' })} />
        <Button flex small kind="secondary" title="Weigh-in" icon="scale" onPress={() => nav.setTab('body')} />
      </Row>

      <Card onPress={() => nav.setTab('body')}>
        <Label>Recovery</Label>
        <Row gap={8}>
          {groups.map((g) => (
            <View key={g} style={{ flex: 1, backgroundColor: t.raised, borderRadius: 12, padding: 10, gap: 2 }}>
              <Txt size={13} weight="600">{GROUP_LABEL[g]}</Txt>
              <Txt size={12} color={rec[g].hoursLeft > 0 ? t.warn : t.good}>{rec[g].hoursLeft > 0 ? `${rec[g].hoursLeft} h left` : 'Ready'}</Txt>
            </View>
          ))}
        </Row>
      </Card>

      {partner ? (
        <ListItem icon="users" iconColor={t.partner} title={partner.name} sub={partner.recent[0] ? `${partner.recent[0].text} · ${niceDate(partner.recent[0].at)}` : 'No activity yet'} onPress={() => nav.setTab('buddy')} />
      ) : (
        <ListItem icon="users" title="Link with your partner" sub="See each other’s progress, end-to-end encrypted" onPress={() => nav.setTab('buddy')} />
      )}
      {!data.settings.lockHash ? <Notice>Tip: set an app passcode in Settings. It also turns on encrypted progress photos.</Notice> : null}
    </Screen>
  );
}
