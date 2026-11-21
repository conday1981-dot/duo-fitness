/** Body readings: metric definitions, trends and the Fitdays screenshot parser. */
import type { MetricKey, Reading, Units } from '../core/types';
import { lenOut, lUnit, round, weightOut, wUnit } from '../core/util';

export interface MetricInfo {
  key: MetricKey;
  label: string;
  kind: 'weight' | 'length' | 'percent' | 'plain';
  estimate: boolean; // scale (bioimpedance) readings are estimates
  aliases: string[]; // words used on a Fitdays report
}

export const METRICS: MetricInfo[] = [
  { key: 'weight', label: 'Weight', kind: 'weight', estimate: false, aliases: ['weight', 'body weight'] },
  { key: 'bodyFat', label: 'Body fat', kind: 'percent', estimate: true, aliases: ['body fat', 'body fat rate', 'fat rate', 'bfr', 'fat%'] },
  { key: 'muscle', label: 'Muscle mass', kind: 'weight', estimate: true, aliases: ['muscle mass', 'muscle', 'skeletal muscle'] },
  { key: 'visceral', label: 'Visceral fat', kind: 'plain', estimate: true, aliases: ['visceral fat', 'visceral'] },
  { key: 'water', label: 'Body water', kind: 'percent', estimate: true, aliases: ['body water', 'water', 'moisture'] },
  { key: 'bone', label: 'Bone mass', kind: 'weight', estimate: true, aliases: ['bone mass', 'bone'] },
  { key: 'protein', label: 'Protein', kind: 'percent', estimate: true, aliases: ['protein'] },
  { key: 'bmr', label: 'BMR', kind: 'plain', estimate: true, aliases: ['bmr', 'basal metabolism', 'basal metabolic rate'] },
  { key: 'bmi', label: 'BMI', kind: 'plain', estimate: false, aliases: ['bmi'] },
  { key: 'waist', label: 'Waist', kind: 'length', estimate: false, aliases: [] },
  { key: 'hips', label: 'Hips', kind: 'length', estimate: false, aliases: [] },
  { key: 'chest', label: 'Chest', kind: 'length', estimate: false, aliases: [] },
  { key: 'arm', label: 'Upper arm', kind: 'length', estimate: false, aliases: [] },
  { key: 'thigh', label: 'Thigh', kind: 'length', estimate: false, aliases: [] },
  { key: 'neck', label: 'Neck', kind: 'length', estimate: false, aliases: [] },
];

export const metricInfo = (k: MetricKey) => METRICS.find((m) => m.key === k)!;

export function unitFor(k: MetricKey, u: Units): string {
  const m = metricInfo(k);
  if (m.kind === 'weight') return wUnit(u);
  if (m.kind === 'length') return lUnit(u);
  if (m.kind === 'percent') return '%';
  return k === 'bmr' ? 'kcal' : '';
}

export function display(k: MetricKey, v: number, u: Units): number {
  const m = metricInfo(k);
  if (m.kind === 'weight') return round(weightOut(v, u));
  if (m.kind === 'length') return round(lenOut(v, u));
  return round(v);
}

export function series(readings: Reading[], k: MetricKey): Reading[] {
  return readings.filter((r) => r.metric === k).sort((a, b) => a.at - b.at);
}

/** Trailing 7-day average at each reading (design doc §6: trends use a 7-day average). */
export function rolling7(rs: Reading[]): { at: number; value: number }[] {
  return rs.map((r, i) => {
    const window = rs.slice(0, i + 1).filter((x) => x.at > r.at - 7 * 86400000);
    return { at: r.at, value: window.reduce((a, x) => a + x.value, 0) / window.length };
  });
}

export function latest(readings: Reading[], k: MetricKey): Reading | undefined {
  const s = series(readings, k);
  return s[s.length - 1];
}

export function changeOver(readings: Reading[], k: MetricKey, days: number): number | undefined {
  const s = rolling7(series(readings, k));
  if (s.length < 2) return undefined;
  const end = s[s.length - 1];
  const startAt = end.at - days * 86400000;
  const start = s.find((x) => x.at >= startAt) ?? s[0];
  return start === end ? undefined : end.value - start.value;
}

export interface ParsedReading {
  metric: MetricKey;
  value: number;
  unit?: string;
}

/**
 * Pull numbers out of text recognised from a Fitdays report screenshot.
 * Works line by line: a known label, then the first number on that line
 * (or the next line, since some layouts put the value under the label).
 * Values in lb are converted to kg. Unknown lines are ignored.
 */
export function parseFitdays(text: string): ParsedReading[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const found = new Map<MetricKey, ParsedReading>();
  const numRe = /(-?\d+(?:[.,]\d+)?)\s*(kg|lb|lbs|%|kcal)?/i;
  const byLength = METRICS.flatMap((m) => m.aliases.map((a) => ({ m, a }))).sort((x, y) => y.a.length - x.a.length);
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    const hit = byLength.find(({ a }) => low.startsWith(a) || low.includes(` ${a}`) || low === a);
    if (!hit || found.has(hit.m.key)) continue;
    const rest = lines[i].slice(low.indexOf(hit.a) + hit.a.length);
    const m = numRe.exec(rest) ?? (lines[i + 1] && !byLength.some(({ a }) => lines[i + 1].toLowerCase().startsWith(a)) ? numRe.exec(lines[i + 1]) : null);
    if (!m) continue;
    let value = parseFloat(m[1].replace(',', '.'));
    const unit = m[2]?.toLowerCase();
    if (hit.m.kind === 'weight' && (unit === 'lb' || unit === 'lbs')) value = value * 0.45359237;
    if (!Number.isFinite(value) || value <= 0) continue;
    found.set(hit.m.key, { metric: hit.m.key, value: round(value, 2), unit });
  }
  return [...found.values()];
}

/** Sanity ranges so a misread digit doesn't get saved silently. */
export function plausible(k: MetricKey, v: number): boolean {
  const r: Partial<Record<MetricKey, [number, number]>> = {
    weight: [25, 300], bodyFat: [2, 70], muscle: [10, 120], visceral: [1, 60], water: [20, 80],
    bone: [0.5, 8], protein: [5, 30], bmr: [700, 4000], bmi: [10, 70],
  };
  const range = r[k];
  return !range || (v >= range[0] && v <= range[1]);
}
