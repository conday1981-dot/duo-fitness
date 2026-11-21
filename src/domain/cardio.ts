/** Distance, GPX import (extra B), interval timing and calorie estimates. */
import type { CardioType, GeoPoint, IntervalStep } from '../core/types';

const R = 6371008.8; // mean Earth radius, metres

export function haversine(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathDistance(points: GeoPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine([points[i - 1][0], points[i - 1][1]], [points[i][0], points[i][1]]);
  return d;
}

/**
 * Accept a new GPS fix only if it's accurate enough and a plausible step
 * (filters drift while standing still and the odd wild jump).
 */
export function acceptFix(prev: GeoPoint | undefined, next: GeoPoint, accuracyM: number | null | undefined): boolean {
  if (accuracyM != null && accuracyM > 35) return false;
  if (!prev) return true;
  const d = haversine([prev[0], prev[1]], [next[0], next[1]]);
  const dt = Math.max(1, (next[2] - prev[2]) / 1000);
  if (d / dt > 12) return false; // faster than 12 m/s on foot
  return d >= 3;
}

export interface GpxTrack {
  name?: string;
  points: GeoPoint[];
  startedAt: number;
  durationS: number;
  distanceM: number;
}

/** Parse a GPX file from Strava, Apple Fitness exports, Garmin, etc. */
export function parseGpx(xml: string): GpxTrack {
  const pts: GeoPoint[] = [];
  const re = /<trkpt\b[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)|<trkpt\b[^>]*?lon="([-\d.]+)"[^>]*?lat="([-\d.]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = parseFloat(m[1] ?? m[5]);
    const lon = parseFloat(m[2] ?? m[4]);
    const inner = m[3] ?? m[6] ?? '';
    const t = /<time>([^<]+)<\/time>/.exec(inner);
    pts.push([lat, lon, t ? Date.parse(t[1]) : NaN]);
  }
  if (pts.length < 2) throw new Error('No track points found in this file.');
  const timed = pts.filter((p) => Number.isFinite(p[2]));
  const startedAt = timed[0]?.[2] ?? Date.now();
  const durationS = timed.length > 1 ? Math.round((timed[timed.length - 1][2] - timed[0][2]) / 1000) : 0;
  const name = /<name>([^<]+)<\/name>/.exec(xml)?.[1]?.trim();
  return { name, points: pts.map((p) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : startedAt]), startedAt, durationS, distanceM: Math.round(pathDistance(pts)) };
}

/** Where are we in an interval programme after `elapsed` seconds? */
export function intervalAt(steps: IntervalStep[], elapsedS: number) {
  let t = 0;
  for (let i = 0; i < steps.length; i++) {
    const len = steps[i].mins * 60;
    if (elapsedS < t + len) return { index: i, step: steps[i], left: t + len - elapsedS, intoStep: elapsedS - t, done: false };
    t += len;
  }
  return { index: steps.length - 1, step: steps[steps.length - 1], left: 0, intoStep: 0, done: true };
}

export const totalMins = (steps: IntervalStep[]) => steps.reduce((a, s) => a + s.mins, 0);

/**
 * Approximate MET values from the Compendium of Physical Activities.
 * kcal ≈ MET × kg × hours. Always shown labelled as an estimate.
 */
export const MET: Record<CardioType | 'strength' | 'jog' | 'intimacy', number> = {
  walk: 3.5, jog: 7.0, run: 9.8, intervals: 5.5, cycle: 7.5, strength: 5.0, intimacy: 1.8,
};

export function kcal(met: number, kg: number, seconds: number): number {
  return Math.round(met * kg * (seconds / 3600));
}

export const MET_SOURCE = 'Estimate from MET values (Compendium of Physical Activities) and your weight';
