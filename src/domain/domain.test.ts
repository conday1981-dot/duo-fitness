import { describe, expect, it } from 'vitest';
import { bests, e1rm, isPr, platesPerSide, prHint, warmups, suggestNext } from './training';
import { acceptFix, haversine, intervalAt, kcal, parseGpx, pathDistance } from './cardio';
import { parseFitdays, plausible, rolling7 } from './body';
import { dayStreak, goalProgress, onPace, recovery, weekStreak } from './progress';
import { buildIcs } from './ics';
import { makeBackup, readBackup } from './backup';
import { mailboxFor, newPairing, pairingCode, parsePairingCode, unwrap, wrap } from './sync';
import { fillRoles, matches } from './private';
import { programmeDay, PROGRAMMES } from './programmes';
import { deriveKey, fromB64, newSalt, open, passcodeHash, seal, toB64 } from '../core/crypto';
import type { AppData, Goal, Reading, Workout } from '../core/types';
import { addDays, pace, weekStart, ymd } from '../core/util';

const w = (id: string, day: string, sets: [number, number][], ex = 'bench'): Workout => ({
  id, profileId: 'p', name: 'x', startedAt: new Date(`${day}T10:00:00`).getTime(), endedAt: new Date(`${day}T11:00:00`).getTime(),
  entries: [{ exerciseId: ex, sets: sets.map(([kg, reps]) => ({ kg, reps, done: true })) }],
});

describe('training', () => {
  it('estimates 1RM with Epley and caps reps', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(100, 20)).toBe(e1rm(100, 12));
  });
  it('tracks bests and spots PRs', () => {
    const hist = [w('a', '2026-11-01', [[80, 6], [82.5, 5]]), w('b', '2026-11-08', [[82.5, 4]])];
    const b = bests(hist).bench;
    expect(b.kg).toBe(82.5);
    expect(b.reps).toBe(5);
    expect(isPr({ kg: 82.5, reps: 6, done: true }, b)).toBe(true);
    expect(isPr({ kg: 82.5, reps: 5, done: true }, b)).toBe(false);
    expect(isPr({ kg: 82.5, reps: 6, done: true, warmup: true }, b)).toBe(false);
    expect(prHint(b, 82.5)).toContain('6 reps at 82.5 kg beats it');
  });
  it('keeps the heaviest lift when a later set is only longer', () => {
    const plank: Workout = { ...w('c', '2026-11-02', [[0, 0]], 'plank') };
    plank.entries[0].sets = [{ secs: 60, done: true }];
    const b = bests([w('a', '2026-11-01', [[100, 5]]), plank]);
    expect(b.bench.kg).toBe(100);
    expect(b.plank.secs).toBe(60);
  });
  it('builds a warm-up ramp below the working weight', () => {
    const ws = warmups(100);
    expect(ws.map((s) => s.kg)).toEqual([20, 40, 60, 80]);
    expect(ws.every((s) => s.warmup)).toBe(true);
    expect(warmups(20)).toEqual([]);
  });
  it('loads plates per side', () => {
    expect(platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({ plates: [25, 15], leftover: 0 });
    expect(platesPerSide(61, 20, [20, 10, 5, 2.5]).leftover).toBe(0.5);
  });
  it('suggests the next weight', () => {
    expect(suggestNext([{ kg: 60, reps: 8, done: true }, { kg: 60, reps: 8, done: true }], 8, false)).toBe(62.5);
    expect(suggestNext([{ kg: 100, reps: 8, done: true }, { kg: 100, reps: 6, done: true }], 8, true)).toBe(100);
  });
  it('has programmes with valid days', () => {
    for (const p of PROGRAMMES) expect(programmeDay(p, 0)).toBeTruthy();
    expect(PROGRAMMES.find((p) => p.id === 'walk-jog')!.days).toHaveLength(27);
  });
});

describe('cardio', () => {
  it('measures distance', () => {
    expect(haversine([51.5, -0.12], [51.51, -0.12])).toBeCloseTo(1112, -1);
  });
  it('filters GPS drift and jumps', () => {
    const a: [number, number, number] = [51.5, -0.12, 0];
    expect(acceptFix(a, [51.50001, -0.12, 1000], 5)).toBe(false); // 1 m: drift
    expect(acceptFix(a, [51.5001, -0.12, 5000], 5)).toBe(true); // 11 m in 5 s
    expect(acceptFix(a, [51.51, -0.12, 1000], 5)).toBe(false); // 1 km in 1 s
    expect(acceptFix(a, [51.5001, -0.12, 5000], 80)).toBe(false); // poor accuracy
  });
  it('parses GPX in either attribute order', () => {
    const gpx = `<gpx><trk><name>Morning run</name><trkseg>
      <trkpt lat="51.5" lon="-0.12"><time>2026-11-20T07:00:00Z</time></trkpt>
      <trkpt lon="-0.12" lat="51.505"><time>2026-11-20T07:05:00Z</time></trkpt>
      <trkpt lat="51.51" lon="-0.12"/></trkseg></trk></gpx>`;
    const t = parseGpx(gpx);
    expect(t.name).toBe('Morning run');
    expect(t.points).toHaveLength(3);
    expect(t.durationS).toBe(300);
    expect(t.distanceM).toBeCloseTo(1112, -1);
    expect(pathDistance(t.points)).toBeCloseTo(1112, -1);
    expect(() => parseGpx('<gpx></gpx>')).toThrow();
  });
  it('steps through intervals', () => {
    const steps = [{ kind: 'walk' as const, mins: 5 }, { kind: 'jog' as const, mins: 5 }, { kind: 'walk' as const, mins: 5 }];
    expect(intervalAt(steps, 446)).toMatchObject({ index: 1, left: 154 });
    expect(intervalAt(steps, 900).done).toBe(true);
  });
  it('estimates calories and pace', () => {
    expect(kcal(7, 88, 1800)).toBe(308);
    expect(pace(1000, 300, 'metric')).toBe('5:00 /km');
  });
});

describe('body', () => {
  it('parses a Fitdays-style report', () => {
    const text = 'Weight 88.1 kg\nBMI 26.4\nBody Fat Rate 24.1 %\nMuscle Mass\n63.2kg\nVisceral Fat 11\nBody Water 54,0%\nBMR 1842 kcal\nScore 81';
    const p = Object.fromEntries(parseFitdays(text).map((r) => [r.metric, r.value]));
    expect(p).toMatchObject({ weight: 88.1, bmi: 26.4, bodyFat: 24.1, muscle: 63.2, visceral: 11, water: 54, bmr: 1842 });
    expect(p.score).toBeUndefined();
  });
  it('converts lb readings', () => {
    expect(parseFitdays('Weight 194.2 lb')[0].value).toBeCloseTo(88.09, 1);
  });
  it('flags implausible values', () => {
    expect(plausible('bodyFat', 241)).toBe(false);
    expect(plausible('weight', 88)).toBe(true);
  });
  it('averages over 7 days', () => {
    const day = 86400000;
    const rs: Reading[] = [90, 89, 88].map((v, i) => ({ id: String(i), profileId: 'p', at: i * day, metric: 'weight', value: v, source: 'manual' }));
    expect(rolling7(rs).map((x) => x.value)).toEqual([90, 89.5, 89]);
  });
});

describe('progress', () => {
  it('tracks goal progress and pace', () => {
    const g: Goal = { id: 'g', profileId: 'p', kind: 'lose_weight', title: 'Lose 6 kg', metric: 'weight', start: 92, target: 86, deadline: '2027-03-01', createdAt: new Date('2026-10-01').getTime() };
    const rs: Reading[] = [{ id: 'r', profileId: 'p', at: Date.now(), metric: 'weight', value: 88.3, source: 'manual' }];
    const { pct } = goalProgress(g, rs, [], []);
    expect(pct).toBeCloseTo(61.7, 0);
    expect(onPace(g, pct, '2026-11-20')).toBe('ahead');
  });
  it('counts streaks', () => {
    const today = '2026-11-20';
    const days = new Set([today, addDays(today, -1), addDays(today, -2), addDays(today, -4)]);
    expect(dayStreak(days, today)).toBe(3);
    const ws = weekStart(new Date('2026-11-20'));
    const twoWeeks = new Set([0, 2, 4].flatMap((d) => [addDays(ws, d), addDays(ws, d - 7)]));
    expect(weekStreak(twoWeeks, 3, '2026-11-20')).toBe(2);
  });
  it('works out recovery per muscle group', () => {
    const now = new Date('2026-11-20T12:00:00').getTime();
    const r = recovery([w('a', '2026-11-20', [[80, 5]])], now);
    expect(r.chest.hoursLeft).toBe(47);
    expect(r.legs.hoursLeft).toBe(0);
  });
});

describe('crypto, backup, sync', () => {
  it('round-trips base64url', () => {
    const b = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    expect(Array.from(fromB64(toB64(b)))).toEqual(Array.from(b));
  });
  it('seals and refuses tampering or the wrong key', async () => {
    const k = await deriveKey('1234', newSalt());
    const s = seal(k, 'hello', 'aad');
    expect(open(k, s, 'aad')).toBe('hello');
    expect(() => open(k, s, 'other')).toThrow();
    expect(() => open(new Uint8Array(32), s, 'aad')).toThrow();
  });
  it('hashes passcodes consistently', async () => {
    const salt = newSalt();
    expect(await passcodeHash('2468', salt)).toBe(await passcodeHash('2468', salt));
    expect(await passcodeHash('2468', salt)).not.toBe(await passcodeHash('2469', salt));
  });
  it('backs up and restores with the passphrase only', async () => {
    const data = { version: 1, profiles: [{ id: 'p', name: 'Con' }] } as unknown as AppData;
    const file = await makeBackup({ data, photos: { a: 'data:image/png;base64,AAAA' } }, 'correct horse');
    expect(file).not.toContain('Con');
    expect((await readBackup(file, 'correct horse')).data.profiles[0].name).toBe('Con');
    await expect(readBackup(file, 'wrong pass')).rejects.toThrow('Wrong passphrase');
  });
  it('pairs by code and keeps fitness and private records apart', () => {
    const a = newPairing('devA');
    const key = parsePairingCode(`copy this: ${pairingCode(a.coupleKey)} `);
    expect(key).toBe(a.coupleKey);
    expect(mailboxFor(key)).toBe(a.mailbox);
    expect(() => parsePairingCode(pairingCode(a.coupleKey).slice(0, -1) + 'z')).toThrow();
    const e = wrap(key, 'devA', 'snapshot', { name: 'Con' });
    expect(e.blob).not.toContain('Con');
    expect(unwrap<{ name: string }>(a.coupleKey, e)?.name).toBe('Con');
    expect(unwrap(a.coupleKey, { ...e, kind: 'private' })).toBeUndefined();
    expect(unwrap(a.coupleKey, { ...e, from: 'devB' })).toBeUndefined();
  });
});

describe('private + reminders', () => {
  it('only reveals mutual wish-list answers', () => {
    const mine = [{ itemId: 'morning', answer: 'yes' }, { itemId: 'toys', answer: 'no' }, { itemId: 'away', answer: 'maybe' }];
    const theirs = [{ itemId: 'morning', answer: 'maybe' }, { itemId: 'toys', answer: 'yes' }, { itemId: 'away', answer: 'no' }];
    expect(matches(mine, theirs)).toEqual(['morning']);
  });
  it('fills roles with proper pronouns', () => {
    expect(fillRoles("{B} lies behind, chest to {F's} back.", 'Her', 'Him')).toBe('He lies behind, chest to her back.');
    expect(fillRoles("{B} takes {B's} weight, not on {f}.", 'Him', 'Her')).toBe('She takes her weight, not on him.');
  });
  it('writes a calendar file with an alarm', () => {
    const ics = buildIcs([{ uid: 'x', title: 'Weigh-in', date: '2026-11-21', time: '07:00', alarmMinutesBefore: 0, repeatWeekly: true }]);
    expect(ics).toContain('DTSTART:20261121T070000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ymd(new Date('2026-11-21T12:00:00'))).toBe('2026-11-21');
  });
});
