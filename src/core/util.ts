/** Small shared helpers: ids, dates, units, formatting. */
import type { Units } from './types';

export function uid(): string {
  const b = new Uint8Array(9);
  globalThis.crypto?.getRandomValues?.(b) ?? b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)));
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date | number = Date.now()): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Monday of the week containing the date. */
export function weekStart(d: Date | number = Date.now()): string {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return ymd(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function niceDate(t: number | string): string {
  const d = typeof t === 'string' ? parseYmd(t) : new Date(t);
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

/* ----- units: everything is stored metric ----- */
export const KG_PER_LB = 0.45359237;
export const M_PER_MI = 1609.344;

export const weightOut = (kg: number, u: Units) => (u === 'metric' ? kg : kg / KG_PER_LB);
export const weightIn = (v: number, u: Units) => (u === 'metric' ? v : v * KG_PER_LB);
export const wUnit = (u: Units) => (u === 'metric' ? 'kg' : 'lb');
export const distOut = (m: number, u: Units) => (u === 'metric' ? m / 1000 : m / M_PER_MI);
export const dUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi');
export const lenOut = (cm: number, u: Units) => (u === 'metric' ? cm : cm / 2.54);
export const lenIn = (v: number, u: Units) => (u === 'metric' ? v : v * 2.54);
export const lUnit = (u: Units) => (u === 'metric' ? 'cm' : 'in');

export function fmtWeight(kg: number, u: Units, dp = 1): string {
  return `${round(weightOut(kg, u), dp)} ${wUnit(u)}`;
}

/** Pace as m:ss per km or mile. */
export function pace(distanceM: number, secs: number, u: Units): string {
  if (distanceM < 10 || secs < 1) return '–';
  const perUnit = secs / distOut(distanceM, u);
  return `${clock(perUnit)} /${dUnit(u)}`;
}

export const num = (s: string): number | undefined => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
};
