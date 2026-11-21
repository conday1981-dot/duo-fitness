/** Ready-made programmes (extra A). Each day is either strength or cardio. */
import type { IntervalStep } from '../core/types';

export interface ProgrammeDay {
  title: string;
  kind: 'strength' | 'cardio';
  exercises?: { id: string; sets: number; reps: number; secs?: number }[];
  steps?: IntervalStep[];
}

export interface Programme {
  id: string;
  name: string;
  blurb: string;
  daysPerWeek: number;
  where: 'gym' | 'home' | 'outside';
  days: ProgrammeDay[];
}

const iv = (...pairs: [IntervalStep['kind'], number][]): IntervalStep[] => pairs.map(([kind, mins]) => ({ kind, mins }));

/** Walk/jog build-up, 9 weeks × 3 runs. Week n increases jogging time. */
function walkJog(): ProgrammeDay[] {
  const weeks: IntervalStep[][] = [
    iv(['walk', 5], ['jog', 1], ['walk', 2], ['jog', 1], ['walk', 2], ['jog', 1], ['walk', 2], ['jog', 1], ['walk', 5]),
    iv(['walk', 5], ['jog', 2], ['walk', 2], ['jog', 2], ['walk', 2], ['jog', 2], ['walk', 5]),
    iv(['walk', 5], ['jog', 3], ['walk', 2], ['jog', 3], ['walk', 2], ['jog', 3], ['walk', 5]),
    iv(['walk', 5], ['jog', 5], ['walk', 3], ['jog', 5], ['walk', 5]),
    iv(['walk', 5], ['jog', 5], ['walk', 5], ['jog', 5], ['walk', 5]),
    iv(['walk', 5], ['jog', 8], ['walk', 3], ['jog', 8], ['walk', 5]),
    iv(['walk', 5], ['jog', 12], ['walk', 3], ['jog', 8], ['walk', 5]),
    iv(['walk', 5], ['jog', 20], ['walk', 5]),
    iv(['walk', 5], ['jog', 30], ['walk', 5]),
  ];
  return weeks.flatMap((steps, w) => [1, 2, 3].map((n) => ({ title: `Week ${w + 1} · run ${n}`, kind: 'cardio' as const, steps })));
}

export const PROGRAMMES: Programme[] = [
  {
    id: 'full-body-3',
    name: 'Beginner full body',
    blurb: 'Three gym sessions a week, alternating A and B. Add weight when you hit every rep.',
    daysPerWeek: 3,
    where: 'gym',
    days: [
      { title: 'Full body A', kind: 'strength', exercises: [{ id: 'squat', sets: 3, reps: 8 }, { id: 'bench', sets: 3, reps: 8 }, { id: 'row', sets: 3, reps: 8 }, { id: 'plank', sets: 3, reps: 0, secs: 30 }] },
      { title: 'Full body B', kind: 'strength', exercises: [{ id: 'rdl', sets: 3, reps: 8 }, { id: 'ohp', sets: 3, reps: 8 }, { id: 'lat-pulldown', sets: 3, reps: 10 }, { id: 'hip-thrust', sets: 3, reps: 10 }] },
    ],
  },
  {
    id: 'home-bodyweight',
    name: 'Home bodyweight',
    blurb: 'No equipment. Three circuits a week, about 30 minutes.',
    daysPerWeek: 3,
    where: 'home',
    days: [
      { title: 'Circuit 1', kind: 'strength', exercises: [{ id: 'bw-squat', sets: 3, reps: 15 }, { id: 'pushup', sets: 3, reps: 10 }, { id: 'glute-bridge', sets: 3, reps: 15 }, { id: 'plank', sets: 3, reps: 0, secs: 30 }] },
      { title: 'Circuit 2', kind: 'strength', exercises: [{ id: 'lunge', sets: 3, reps: 10 }, { id: 'dips', sets: 3, reps: 10 }, { id: 'dead-bug', sets: 3, reps: 10 }, { id: 'mountain-climber', sets: 3, reps: 0, secs: 30 }] },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / lower',
    blurb: 'Four gym sessions a week for building muscle.',
    daysPerWeek: 4,
    where: 'gym',
    days: [
      { title: 'Upper · push focus', kind: 'strength', exercises: [{ id: 'bench', sets: 4, reps: 6 }, { id: 'incline-db', sets: 3, reps: 10 }, { id: 'db-shoulder', sets: 3, reps: 10 }, { id: 'triceps-pushdown', sets: 3, reps: 12 }] },
      { title: 'Lower · squat focus', kind: 'strength', exercises: [{ id: 'squat', sets: 4, reps: 6 }, { id: 'leg-press', sets: 3, reps: 10 }, { id: 'lunge', sets: 3, reps: 10 }, { id: 'calf-raise', sets: 3, reps: 15 }] },
      { title: 'Upper · pull focus', kind: 'strength', exercises: [{ id: 'row', sets: 4, reps: 6 }, { id: 'lat-pulldown', sets: 3, reps: 10 }, { id: 'face-pull', sets: 3, reps: 15 }, { id: 'curl', sets: 3, reps: 12 }] },
      { title: 'Lower · hinge focus', kind: 'strength', exercises: [{ id: 'deadlift', sets: 3, reps: 5 }, { id: 'hip-thrust', sets: 3, reps: 10 }, { id: 'rdl', sets: 3, reps: 10 }, { id: 'side-plank', sets: 3, reps: 0, secs: 30 }] },
    ],
  },
  {
    id: 'walk-jog',
    name: 'Walk to jog',
    blurb: 'Nine weeks from walking to 30 minutes of jogging. Repeat a week whenever you need to.',
    daysPerWeek: 3,
    where: 'outside',
    days: walkJog(),
  },
];

export const findProgramme = (id?: string) => PROGRAMMES.find((p) => p.id === id);

/** Day to show next; strength programmes loop, walk-to-jog ends. */
export function programmeDay(p: Programme, next: number): ProgrammeDay | undefined {
  if (p.id === 'walk-jog') return p.days[next];
  return p.days[next % p.days.length];
}
