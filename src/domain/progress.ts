/** Goals, recovery, streaks, weekly targets and badges (items 5, D, G). */
import type { CardioSession, Challenge, Goal, MuscleGroup, Reading, Workout } from '../core/types';
import { findExercise } from './exercises';
import { bests } from './training';
import { latest, rolling7, series } from './body';
import { addDays, daysBetween, weekStart, ymd } from '../core/util';

/* ---------------- goals ---------------- */

export function goalProgress(g: Goal, readings: Reading[], workouts: Workout[], cardio: CardioSession[]): { current: number; pct: number } {
  let current = g.start;
  if (g.metric) {
    const s = rolling7(series(readings.filter((r) => r.profileId === g.profileId), g.metric));
    if (s.length) current = s[s.length - 1].value;
  } else if (g.kind === 'lift' && g.exerciseId) {
    current = bests(workouts.filter((w) => w.profileId === g.profileId))[g.exerciseId]?.e1rm ?? g.start;
  } else if (g.kind === 'distance') {
    current = cardio.filter((c) => c.profileId === g.profileId && c.startedAt >= g.createdAt).reduce((a, c) => a + c.distanceM / 1000, 0);
  }
  const span = g.target - g.start;
  const pct = span === 0 ? 100 : Math.max(0, Math.min(100, ((current - g.start) / span) * 100));
  return { current, pct };
}

/** Is the goal on pace for its deadline? Compares progress % with time elapsed %. */
export function onPace(g: Goal, pct: number, today = ymd()): 'ahead' | 'on pace' | 'behind' {
  const total = Math.max(1, daysBetween(ymd(g.createdAt), g.deadline));
  const gone = Math.min(total, Math.max(0, daysBetween(ymd(g.createdAt), today)));
  const expected = (gone / total) * 100;
  if (pct >= expected + 5) return 'ahead';
  if (pct >= expected - 5) return 'on pace';
  return 'behind';
}

/* ---------------- recovery (body map) ---------------- */

/** Hours a group needs after a hard session (rule of thumb, adjustable later). */
export const RECOVERY_HOURS: Record<MuscleGroup, number> = { chest: 48, back: 48, shoulders: 48, arms: 36, core: 24, legs: 72, glutes: 60 };
export const CARDIO_RECOVERY_HOURS = { walk: 0, jog: 24, run: 36, intervals: 24, cycle: 24 } as const;

export function recovery(workouts: Workout[], now = Date.now()): Record<MuscleGroup, { hoursLeft: number; last?: number }> {
  const out = Object.fromEntries(Object.keys(RECOVERY_HOURS).map((g) => [g, { hoursLeft: 0 }])) as Record<MuscleGroup, { hoursLeft: number; last?: number }>;
  for (const w of workouts) {
    if (!w.endedAt) continue;
    for (const e of w.entries) {
      const ex = findExercise(e.exerciseId);
      if (!ex || !e.sets.some((s) => s.done && !s.warmup)) continue;
      for (const [g, factor] of [[ex.group, 1], ...(ex.also ?? []).map((a) => [a, 0.5] as const)] as [MuscleGroup, number][]) {
        const left = (w.endedAt + RECOVERY_HOURS[g] * factor * 3600000 - now) / 3600000;
        const cur = out[g];
        if (!cur.last || w.endedAt > cur.last) cur.last = w.endedAt;
        cur.hoursLeft = Math.max(cur.hoursLeft, Math.round(left));
      }
    }
  }
  return out;
}

/* ---------------- streaks, weekly target, badges ---------------- */

export function activeDays(workouts: Workout[], cardio: CardioSession[]): Set<string> {
  return new Set([...workouts.filter((w) => w.endedAt).map((w) => ymd(w.startedAt)), ...cardio.map((c) => ymd(c.startedAt))]);
}

/** Consecutive weeks (ending this week) that hit the weekly target. */
export function weekStreak(days: Set<string>, target: number, today = ymd()): number {
  let streak = 0;
  let wk = weekStart(new Date(today));
  const countIn = (start: string) => [...Array(7)].filter((_, i) => days.has(addDays(start, i))).length;
  if (countIn(wk) < target) wk = addDays(wk, -7); // this week still in progress
  while (countIn(wk) >= target) {
    streak++;
    wk = addDays(wk, -7);
  }
  return streak;
}

/** Consecutive days up to today (or yesterday) with any activity. */
export function dayStreak(days: Set<string>, today = ymd()): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function thisWeekCount(days: Set<string>, today = ymd()): number {
  const ws = weekStart(new Date(today));
  return [...Array(7)].filter((_, i) => days.has(addDays(ws, i))).length;
}

export interface Badge {
  id: string;
  title: string;
  detail: string;
  earned: boolean;
}

export function badges(workouts: Workout[], cardio: CardioSession[], readings: Reading[], goals: Goal[], target: number): Badge[] {
  const done = workouts.filter((w) => w.endedAt);
  const days = activeDays(done, cardio);
  const km = cardio.reduce((a, c) => a + c.distanceM, 0) / 1000;
  const prCount = Object.keys(bests(done)).length;
  const weighIns = series(readings, 'weight').length;
  const b = (id: string, title: string, detail: string, earned: boolean): Badge => ({ id, title, detail, earned });
  return [
    b('first-workout', 'First session', 'Finish your first workout', done.length >= 1),
    b('ten-workouts', 'Ten down', 'Finish 10 workouts', done.length >= 10),
    b('fifty-workouts', 'Regular', 'Finish 50 workouts', done.length >= 50),
    b('first-run', 'Out the door', 'Log your first walk or run', cardio.length >= 1),
    b('5k', '5K total', 'Cover 5 km in total', km >= 5),
    b('100k', '100 km club', 'Cover 100 km in total', km >= 100),
    b('week-streak-4', 'Four-week streak', `Hit your weekly target (${target}) four weeks running`, weekStreak(days, target) >= 4),
    b('day-streak-7', 'Seven days', 'Be active seven days in a row', dayStreak(days) >= 7),
    b('prs-10', 'Record breaker', 'Set records on 10 exercises', prCount >= 10),
    b('weigh-ins-14', 'Consistent scale', 'Log 14 weigh-ins', weighIns >= 14),
    b('goal-done', 'Goal smashed', 'Reach a goal', goals.some((g) => g.doneAt)),
  ];
}

export function latestWeight(readings: Reading[], profileId: string): number | undefined {
  return latest(readings.filter((r) => r.profileId === profileId), 'weight')?.value;
}

/** This phone's contribution to a joint challenge (km or workouts within its dates). */
export function challengeTotal(c: Challenge, workouts: Workout[], cardio: CardioSession[]): number {
  const inRange = (t: number) => ymd(t) >= c.start && ymd(t) <= c.end;
  if (c.metric === 'distance') return Math.round(cardio.filter((x) => inRange(x.startedAt)).reduce((a, x) => a + x.distanceM, 0) / 100) / 10;
  return workouts.filter((w) => w.endedAt && inRange(w.startedAt)).length + cardio.filter((x) => inRange(x.startedAt)).length;
}
