/** DUO data model. Everything here lives on the phone; see docs/design.md. */

export type ThemeName = 'con' | 'honey';
export type Units = 'metric' | 'imperial';
export type Sex = 'male' | 'female';

export interface Profile {
  id: string;
  name: string;
  sex: Sex;
  theme: ThemeName;
  units: Units;
  heightCm?: number;
  createdAt: number;
}

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'glutes';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band';
export type ExerciseKind = 'weight' | 'bodyweight' | 'time';

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  also?: MuscleGroup[];
  equipment: Equipment;
  kind: ExerciseKind;
  cues: string[];
  custom?: boolean;
}

export interface WorkoutSet {
  kg?: number;
  reps?: number;
  secs?: number;
  warmup?: boolean;
  done: boolean;
}

export interface WorkoutEntry {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  profileId: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  entries: WorkoutEntry[];
  programmeId?: string;
  dayIndex?: number;
}

export type CardioType = 'walk' | 'jog' | 'run' | 'intervals' | 'cycle';
export interface IntervalStep {
  kind: 'walk' | 'jog' | 'run';
  mins: number;
}

/** [lat, lon, unix ms] */
export type GeoPoint = [number, number, number];

export interface CardioSession {
  id: string;
  profileId: string;
  type: CardioType;
  startedAt: number;
  durationS: number;
  distanceM: number;
  source: 'gps' | 'gpx' | 'manual';
  steps?: IntervalStep[];
  points?: GeoPoint[];
  routeTargetM?: number;
}

export type MetricKey =
  | 'weight' | 'bodyFat' | 'muscle' | 'visceral' | 'water' | 'bone' | 'protein' | 'bmr' | 'bmi'
  | 'waist' | 'hips' | 'chest' | 'arm' | 'thigh' | 'neck';

export interface Reading {
  id: string;
  profileId: string;
  at: number;
  metric: MetricKey;
  value: number;
  source: 'manual' | 'screenshot' | 'health';
}

export type GoalKind = 'lose_weight' | 'gain_weight' | 'lose_fat' | 'gain_muscle' | 'tone' | 'lift' | 'distance';
export interface Goal {
  id: string;
  profileId: string;
  kind: GoalKind;
  title: string;
  metric?: MetricKey;
  exerciseId?: string;
  start: number;
  target: number;
  deadline: string; // YYYY-MM-DD
  createdAt: number;
  doneAt?: number;
}

export type PlanKind = 'strength' | 'cardio' | 'rest' | 'measure';
export interface PlanItem {
  id: string;
  profileId: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  kind: PlanKind;
  title: string;
  programmeId?: string;
  dayIndex?: number;
  doneRef?: string; // workout or cardio id
}

export interface Photo {
  id: string;
  profileId: string;
  at: number;
  pose: 'front' | 'side' | 'back';
}

export interface ProgrammeEnrolment {
  programmeId: string;
  startedOn: string;
  nextDay: number;
}

export interface Settings {
  restSeconds: number;
  barKg: number;
  plates: number[];
  weeklyTarget: number;
  lockHash?: string; // scrypt hash of the app passcode
  lockSalt?: string;
  privateSalt?: string; // set once the private section is turned on
  privateCheck?: string; // sealed known value to verify the private passcode
  relayUrl?: string;
}

/** Data synced from the partner's phone (read-only here). */
export interface PartnerSnapshot {
  name: string;
  theme: ThemeName;
  updatedAt: number;
  week: { workouts: number; distanceKm: number; streak: number; prs: number };
  recent: { at: number; text: string }[];
  goals?: { title: string; pct: number }[];
  challengeProgress?: Record<string, number>;
}

export interface Challenge {
  id: string;
  title: string;
  metric: 'distance' | 'workouts';
  target: number;
  start: string;
  end: string;
}

export interface Cheer {
  id: string;
  at: number;
  from: string;
  text: string;
  seen?: boolean;
}

export interface Pairing {
  coupleKey: string; // b64url 32 bytes, never sent to the relay
  mailbox: string; // derived, sent to the relay
  deviceId: string;
  pairedAt: number;
  lastPull?: number;
  lastSync?: number;
}

export interface AppData {
  version: 1;
  profiles: Profile[];
  activeProfileId?: string;
  customExercises: Exercise[];
  workouts: Workout[];
  cardio: CardioSession[];
  readings: Reading[];
  goals: Goal[];
  plan: PlanItem[];
  photos: Photo[];
  programmes: Record<string, ProgrammeEnrolment | undefined>; // by profile id
  settings: Settings;
  pairing?: Pairing;
  partner?: PartnerSnapshot;
  challenges: Challenge[];
  cheers: Cheer[];
  /** Sealed sync records waiting to upload (opaque to everything but the partner). */
  outbox: { id: string; kind: 'snapshot' | 'cheer' | 'challenge' | 'private'; from: string; at: number; blob: string }[];
  /** Private records received while the private section was locked. */
  privateInbox: { id: string; kind: 'snapshot' | 'cheer' | 'challenge' | 'private'; from: string; at: number; blob: string }[];
}

/* ---------- Private section (encrypted with its own passcode) ---------- */

export interface IntimacyLog {
  id: string;
  at: number;
  acts: string[]; // catalogue ids
  mins?: number;
  note?: string; // private to this phone
  rating?: number; // private to this phone
  by: string; // device id
}

export interface WishAnswer {
  itemId: string;
  answer: 'yes' | 'maybe' | 'no';
}

export interface DatePlan {
  id: string;
  date: string;
  title: string;
  note?: string;
}

export interface PrivateData {
  logs: IntimacyLog[];
  favourites: string[];
  wantToTry: string[];
  customEntries: { id: string; name: string; text: string }[];
  wish: WishAnswer[];
  partnerWish: WishAnswer[];
  dates: DatePlan[];
  showFitness: boolean;
}
