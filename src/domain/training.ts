/** Workout maths: PRs, estimated 1RM, volume, warm-up sets, plate loading. */
import type { Workout, WorkoutSet } from '../core/types';

/** Epley estimate; reps above 12 are unreliable so they are capped. */
export function e1rm(kg: number, reps: number): number {
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : kg * (1 + Math.min(reps, 12) / 30);
}

export interface Best {
  kg: number;
  reps: number;
  e1rm: number;
  secs: number;
  at: number;
}

/** Best working set per exercise, across finished workouts. */
export function bests(workouts: Workout[], excludeId?: string): Record<string, Best> {
  const out: Record<string, Best> = {};
  for (const w of workouts) {
    if (w.id === excludeId || !w.endedAt) continue;
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (!s.done || s.warmup) continue;
        const score = e1rm(s.kg ?? 0, s.reps ?? 0);
        const cur = out[e.exerciseId] ?? { kg: 0, reps: 0, e1rm: 0, secs: 0, at: w.startedAt };
        // Weight/reps record and time record are tracked separately.
        const liftBetter = score > cur.e1rm || (score === cur.e1rm && (s.reps ?? 0) > cur.reps);
        out[e.exerciseId] = {
          kg: liftBetter ? (s.kg ?? 0) : cur.kg,
          reps: liftBetter ? (s.reps ?? 0) : cur.reps,
          e1rm: Math.max(score, cur.e1rm),
          secs: Math.max(s.secs ?? 0, cur.secs),
          at: liftBetter ? w.startedAt : cur.at,
        };
      }
    }
  }
  return out;
}

/** True when this set beats the previous best (by estimated 1RM, reps at bodyweight, or time). */
export function isPr(set: WorkoutSet, best?: Best): boolean {
  if (!set.done || set.warmup) return false;
  if (!best) return (set.kg ?? 0) > 0 || (set.reps ?? 0) > 0 || (set.secs ?? 0) > 0;
  if ((set.secs ?? 0) > 0) return (set.secs ?? 0) > best.secs;
  if (!set.kg) return (set.reps ?? 0) > best.reps && best.kg === 0;
  return e1rm(set.kg, set.reps ?? 0) > best.e1rm + 0.01;
}

/** "One more rep at X beats it" style hint for the next set. */
export function prHint(best: Best | undefined, kg: number | undefined): string | undefined {
  if (!best || !best.e1rm) return undefined;
  if (!kg) return `PR is ${best.kg} kg × ${best.reps}`;
  for (let reps = 1; reps <= 30; reps++) {
    if (e1rm(kg, reps) > best.e1rm + 0.01) return `PR is ${best.kg} kg × ${best.reps}. ${reps} rep${reps > 1 ? 's' : ''} at ${kg} kg beats it.`;
  }
  return `PR is ${best.kg} kg × ${best.reps}.`;
}

export function volume(w: Workout): number {
  return w.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done && !s.warmup ? (s.kg ?? 0) * (s.reps ?? 0) : 0), 0), 0);
}

export function prsInWorkout(w: Workout, history: Workout[]): string[] {
  const before = bests(history, w.id);
  const out = new Set<string>();
  for (const e of w.entries) for (const s of e.sets) if (isPr(s, before[e.exerciseId])) out.add(e.exerciseId);
  return [...out];
}

/** Warm-up ramp for a working weight: bar, then ~40/60/80%. */
export function warmups(workKg: number, barKg = 20, step = 2.5): WorkoutSet[] {
  if (workKg <= barKg + step) return [];
  const r = (kg: number) => Math.max(barKg, Math.round(kg / step) * step);
  const raw: [number, number][] = [[barKg, 10], [r(workKg * 0.4), 8], [r(workKg * 0.6), 5], [r(workKg * 0.8), 3]];
  const seen = new Set<number>();
  return raw
    .filter(([kg]) => kg < workKg && !seen.has(kg) && seen.add(kg))
    .map(([kg, reps]) => ({ kg, reps, warmup: true, done: false }));
}

/** Plates for ONE side of the bar, largest first. Returns leftover if it can't be made exactly. */
export function platesPerSide(targetKg: number, barKg: number, plates: number[]): { plates: number[]; leftover: number } {
  let side = (targetKg - barKg) / 2;
  const out: number[] = [];
  if (side <= 0) return { plates: [], leftover: Math.max(0, side) };
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      out.push(p);
      side -= p;
    }
  }
  return { plates: out, leftover: Math.round(side * 1000) / 1000 };
}

/** Next suggested weight: +2.5 kg (upper) / +5 kg (lower) after hitting all reps. */
export function suggestNext(lastSets: WorkoutSet[], targetReps: number, lower: boolean): number | undefined {
  const work = lastSets.filter((s) => s.done && !s.warmup && s.kg);
  if (!work.length) return undefined;
  const kg = Math.max(...work.map((s) => s.kg ?? 0));
  const allHit = work.every((s) => (s.reps ?? 0) >= targetReps);
  return allHit ? kg + (lower ? 5 : 2.5) : kg;
}
