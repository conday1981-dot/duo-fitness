/**
 * App state: loads from on-phone storage, saves on every change (debounced),
 * and owns the app lock, the private vault, progress photos and sync.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Cheer, Challenge, IntimacyLog, PartnerSnapshot, PrivateData, Profile, Workout } from './types';
import { getItem, removeItem, requestPersistence, setItem } from './storage';
import { deriveKey, newSalt, open, openJson, passcodeHash, seal, sealJson, subKey, toB64 } from './crypto';
import { uid, ymd } from './util';
import { httpRelay, newDeviceId, unwrap, wrap, type Envelope } from '../domain/sync';
import { activeDays, challengeTotal, dayStreak, thisWeekCount, goalProgress } from '../domain/progress';
import { bests, prsInWorkout } from '../domain/training';

const KEY = 'duo.v1';
/** JSON deep copy (data is plain JSON; avoids relying on structuredClone in every JS engine). */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const PRIVATE_KEY = 'duo.v1.private';
const photoKey = (id: string) => `duo.v1.photo.${id}`;

export const emptyData = (): AppData => ({
  version: 1, profiles: [], customExercises: [], workouts: [], cardio: [], readings: [], goals: [], plan: [], photos: [],
  programmes: {}, settings: { restSeconds: 120, barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], weeklyTarget: 3 },
  challenges: [], cheers: [], outbox: [], privateInbox: [],
});

export const emptyPrivate = (): PrivateData => ({ logs: [], favourites: [], wantToTry: [], customEntries: [], wish: [], partnerWish: [], dates: [], showFitness: true });

/** Where the relay lives: same site as the app, unless overridden in Settings. */
function relayBase(d: AppData): string | undefined {
  if (d.settings.relayUrl) return d.settings.relayUrl;
  const loc = (globalThis as { location?: Location }).location;
  // The relay lives on the same Worker that serves the app. Off in sandboxed
  // claude.ai previews; localhost is allowed for testing with `wrangler dev`.
  const local = /^(localhost|127\.0\.0\.1)$/.test(loc?.hostname ?? '');
  if (loc && (loc.protocol === 'https:' || local) && !/claude|claudeusercontent/.test(loc.hostname)) return loc.origin;
  return undefined;
}

interface Store {
  ready: boolean;
  data: AppData;
  profile?: Profile;
  update: (fn: (d: AppData) => void) => void;
  locked: boolean;
  unlock: (pass: string) => Promise<boolean>;
  setLock: (pass?: string) => Promise<void>;
  lockNow: () => void;
  // private vault
  privateOpen: boolean;
  priv: PrivateData;
  privateEnabled: boolean;
  enablePrivate: (pass: string) => Promise<void>;
  openPrivate: (pass: string) => Promise<boolean>;
  closePrivate: () => void;
  updatePrivate: (fn: (p: PrivateData) => void, share?: { kind: 'log' | 'wish' | 'date'; payload: unknown }) => void;
  privateSealedForBackup: () => Promise<string | undefined>;
  // photos
  savePhoto: (id: string, dataUrl: string) => Promise<void>;
  loadPhoto: (id: string) => Promise<string | null>;
  rawPhotos: () => Promise<Record<string, string>>;
  photosReady: boolean;
  deletePhoto: (id: string) => Promise<void>;
  // sync
  relayAvailable: boolean;
  syncing: boolean;
  syncError?: string;
  syncNow: () => Promise<void>;
  sendCheer: (text: string) => void;
  shareChallenge: (c: Challenge) => void;
  replaceAll: (d: AppData, photos: Record<string, string>, privateSealed?: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [locked, setLocked] = useState(false);
  const [priv, setPriv] = useState<PrivateData>(emptyPrivate);
  const privKey = useRef<Uint8Array | null>(null);
  /** Photo key: derived from the app passcode at unlock; photos are sealed with it. */
  const photoKeyRef = useRef<Uint8Array | null>(null);
  const [photosReady, setPhotosReady] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string>();
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    (async () => {
      const raw = await getItem(KEY);
      if (raw) {
        const loaded = { ...emptyData(), ...JSON.parse(raw) } as AppData;
        setData(loaded);
        setLocked(!!loaded.settings.lockHash);
      }
      requestPersistence();
      setReady(true);
    })();
  }, []);

  // Save shortly after each change.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setItem(KEY, JSON.stringify(data)), 250);
    return () => clearTimeout(t);
  }, [data, ready]);

  const update = useCallback((fn: (d: AppData) => void) => {
    setData((prev) => {
      const next: AppData = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const profile = data.profiles.find((p) => p.id === data.activeProfileId) ?? data.profiles[0];

  /* ---------- app lock ---------- */
  const unlock = useCallback(async (pass: string) => {
    const s = dataRef.current.settings;
    if (!s.lockHash || !s.lockSalt) return setLocked(false), true;
    const ok = (await passcodeHash(pass, s.lockSalt)) === s.lockHash;
    if (ok) {
      photoKeyRef.current = subKey(await deriveKey(pass, s.lockSalt), 'photos');
      setPhotosReady(true);
      setLocked(false);
    }
    return ok;
  }, []);

  const setLock = useCallback(async (pass?: string) => {
    if (!pass) {
      if (dataRef.current.photos.length) throw new Error('Delete your progress photos first: they are encrypted with this passcode.');
      photoKeyRef.current = null;
      setPhotosReady(false);
      return update((d) => { delete d.settings.lockHash; delete d.settings.lockSalt; });
    }
    if (dataRef.current.photos.length) throw new Error('Delete your progress photos before changing the passcode: they are encrypted with the current one.');
    const salt = newSalt();
    const hash = await passcodeHash(pass, salt);
    photoKeyRef.current = subKey(await deriveKey(pass, salt), 'photos');
    setPhotosReady(true);
    update((d) => { d.settings.lockSalt = salt; d.settings.lockHash = hash; });
  }, [update]);

  const lockNow = useCallback(() => {
    privKey.current = null;
    if (dataRef.current.settings.lockHash) {
      photoKeyRef.current = null;
      setPhotosReady(false);
    }
    setPrivateOpen(false);
    setPriv(emptyPrivate());
    if (dataRef.current.settings.lockHash) setLocked(true);
  }, []);

  /* ---------- private vault ---------- */
  const savePrivate = useCallback(async (p: PrivateData) => {
    if (privKey.current) await setItem(PRIVATE_KEY, sealJson(privKey.current, p, 'duo-private'));
  }, []);

  const applyPrivateRecords = useCallback((p: PrivateData, envs: Envelope[], coupleKey: string) => {
    for (const e of envs) {
      const body = unwrap<{ kind: 'log' | 'wish' | 'date'; payload: unknown }>(coupleKey, e);
      if (!body) continue;
      if (body.kind === 'log') {
        const log = body.payload as IntimacyLog;
        if (!p.logs.some((l) => l.id === log.id)) p.logs.push(log);
      } else if (body.kind === 'wish') {
        p.partnerWish = body.payload as PrivateData['partnerWish'];
      } else if (body.kind === 'date') {
        const dp = body.payload as PrivateData['dates'][number];
        p.dates = [...p.dates.filter((x) => x.id !== dp.id), dp];
      }
    }
    return p;
  }, []);

  const openWithKey = useCallback(async (key: Uint8Array) => {
    const sealed = await getItem(PRIVATE_KEY);
    let p = sealed ? openJson<PrivateData>(key, sealed, 'duo-private') : emptyPrivate();
    p = { ...emptyPrivate(), ...p };
    const d = dataRef.current;
    if (d.pairing && d.privateInbox.length) {
      p = applyPrivateRecords(p, d.privateInbox, d.pairing.coupleKey);
      update((x) => { x.privateInbox = []; });
    }
    privKey.current = key;
    setPriv(p);
    setPrivateOpen(true);
    await setItem(PRIVATE_KEY, sealJson(key, p, 'duo-private'));
  }, [applyPrivateRecords, update]);

  const enablePrivate = useCallback(async (pass: string) => {
    const salt = newSalt();
    const key = await deriveKey(pass, salt);
    const check = sealJson(subKey(key, 'check'), 'ok');
    update((d) => { d.settings.privateSalt = salt; d.settings.privateCheck = check; });
    await removeItem(PRIVATE_KEY);
    await openWithKey(key);
  }, [openWithKey, update]);

  const openPrivate = useCallback(async (pass: string) => {
    const s = dataRef.current.settings;
    if (!s.privateSalt || !s.privateCheck) return false;
    const key = await deriveKey(pass, s.privateSalt);
    try {
      openJson(subKey(key, 'check'), s.privateCheck);
    } catch {
      return false;
    }
    await openWithKey(key);
    return true;
  }, [openWithKey]);

  const closePrivate = useCallback(() => {
    privKey.current = null;
    setPrivateOpen(false);
    setPriv(emptyPrivate());
  }, []);

  const queue = useCallback((kind: Envelope['kind'], body: unknown) => {
    const d = dataRef.current;
    if (!d.pairing) return;
    const env = wrap(d.pairing.coupleKey, d.pairing.deviceId, kind, body);
    update((x) => { x.outbox.push(env); });
  }, [update]);

  const updatePrivate = useCallback((fn: (p: PrivateData) => void, share?: { kind: 'log' | 'wish' | 'date'; payload: unknown }) => {
    setPriv((prev) => {
      const next = clone(prev);
      fn(next);
      savePrivate(next);
      return next;
    });
    if (share) queue('private', share);
  }, [queue, savePrivate]);

  const privateSealedForBackup = useCallback(async () => (await getItem(PRIVATE_KEY)) ?? undefined, []);

  /* ---------- photos ---------- */
  const savePhoto = useCallback(async (id: string, url: string) => {
    if (!photoKeyRef.current) throw new Error('Set an app passcode first: progress photos are encrypted with it.');
    await setItem(photoKey(id), seal(photoKeyRef.current, url, `photo:${id}`));
  }, []);
  const loadPhoto = useCallback(async (id: string) => {
    const raw = await getItem(photoKey(id));
    if (!raw || !photoKeyRef.current) return null;
    try {
      return open(photoKeyRef.current, raw, `photo:${id}`);
    } catch {
      return null;
    }
  }, []);
  /** Sealed photo blobs exactly as stored, for backups. */
  const rawPhotos = useCallback(async () => {
    const out: Record<string, string> = {};
    for (const p of dataRef.current.photos) {
      const raw = await getItem(photoKey(p.id));
      if (raw) out[p.id] = raw;
    }
    return out;
  }, []);
  const deletePhoto = useCallback(async (id: string) => {
    await removeItem(photoKey(id));
    update((d) => { d.photos = d.photos.filter((p) => p.id !== id); });
  }, [update]);

  /* ---------- sync ---------- */
  const relayAvailable = !!relayBase(data) && !!data.pairing;

  const snapshot = useCallback((): PartnerSnapshot | undefined => {
    const d = dataRef.current;
    const p = d.profiles.find((x) => x.id === d.activeProfileId) ?? d.profiles[0];
    if (!p) return undefined;
    const mine = (xs: { profileId: string }[]) => xs.filter((x) => x.profileId === p.id);
    const ws = mine(d.workouts) as Workout[];
    const cs = mine(d.cardio) as typeof d.cardio;
    const weekAgo = Date.now() - 7 * 86400000;
    const days = activeDays(ws, cs);
    const recentWorkouts = ws.filter((w) => w.endedAt).slice(-5).map((w) => {
      const prs = prsInWorkout(w, ws).length;
      return { at: w.startedAt, text: `${w.name} · ${Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60000)} min${prs ? ` · ${prs} PR${prs > 1 ? 's' : ''}` : ''}` };
    });
    const recentCardio = cs.slice(-5).map((c) => ({ at: c.startedAt, text: `${c.type} · ${(c.distanceM / 1000).toFixed(2)} km` }));
    const prs = Object.values(bests(ws)).filter((b) => b.at > weekAgo).length;
    return {
      name: p.name, theme: p.theme, updatedAt: Date.now(),
      week: { workouts: thisWeekCount(days), distanceKm: cs.filter((c) => c.startedAt > weekAgo).reduce((a, c) => a + c.distanceM / 1000, 0), streak: dayStreak(days), prs },
      challengeProgress: Object.fromEntries(d.challenges.map((c) => [c.id, challengeTotal(c, ws, cs)])),
      recent: [...recentWorkouts, ...recentCardio].sort((a, b) => b.at - a.at).slice(0, 6),
      goals: d.goals.filter((g) => g.profileId === p.id && !g.doneAt).map((g) => ({ title: g.title, pct: Math.round(goalProgress(g, d.readings, d.workouts, d.cardio).pct) })),
    };
  }, []);

  const syncNow = useCallback(async () => {
    const d = dataRef.current;
    const base = relayBase(d);
    if (!d.pairing || !base) return;
    setSyncing(true);
    setSyncError(undefined);
    try {
      const relay = httpRelay(base);
      const snap = snapshot();
      const out = [...d.outbox, ...(snap ? [wrap(d.pairing.coupleKey, d.pairing.deviceId, 'snapshot', snap)] : [])];
      if (out.length) await relay.push(d.pairing.mailbox, out);
      const incoming = await relay.pull(d.pairing.mailbox, d.pairing.lastPull ?? 0, d.pairing.deviceId);
      const key = d.pairing.coupleKey;
      const privateEnvs: Envelope[] = [];
      update((x) => {
        x.outbox = x.outbox.filter((e) => !out.some((o) => o.id === e.id));
        for (const e of incoming) {
          if (e.kind === 'snapshot') {
            const s = unwrap<PartnerSnapshot>(key, e);
            if (s && (!x.partner || s.updatedAt >= x.partner.updatedAt)) x.partner = s;
          } else if (e.kind === 'cheer') {
            const c = unwrap<Cheer>(key, e);
            if (c && !x.cheers.some((y) => y.id === c.id)) x.cheers.push({ ...c, seen: false });
          } else if (e.kind === 'challenge') {
            const c = unwrap<Challenge>(key, e);
            if (c) x.challenges = [...x.challenges.filter((y) => y.id !== c.id), c];
          } else if (e.kind === 'private') {
            privateEnvs.push(e);
          }
        }
        if (x.pairing) {
          x.pairing.lastPull = Math.max(x.pairing.lastPull ?? 0, ...incoming.map((e) => e.seq));
          x.pairing.lastSync = Date.now();
        }
        if (privateEnvs.length && !privKey.current) x.privateInbox.push(...privateEnvs);
      });
      if (privateEnvs.length && privKey.current) {
        setPriv((prev) => {
          const next = applyPrivateRecords(clone(prev), privateEnvs, key);
          savePrivate(next);
          return next;
        });
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [applyPrivateRecords, savePrivate, snapshot, update]);

  // Sync when the app opens and every 2 minutes while it's open.
  useEffect(() => {
    if (!ready || !data.pairing) return;
    syncNow();
    const t = setInterval(syncNow, 120000);
    return () => clearInterval(t);
  }, [ready, data.pairing?.mailbox]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCheer = useCallback((text: string) => {
    const name = profile?.name ?? 'Partner';
    queue('cheer', { id: uid(), at: Date.now(), from: name, text } satisfies Cheer);
    setTimeout(syncNow, 50);
  }, [profile?.name, queue, syncNow]);

  const shareChallenge = useCallback((c: Challenge) => {
    update((d) => { d.challenges = [...d.challenges.filter((x) => x.id !== c.id), c]; });
    queue('challenge', c);
    setTimeout(syncNow, 50);
  }, [queue, syncNow, update]);

  const replaceAll = useCallback(async (d: AppData, photos: Record<string, string>, privateSealed?: string) => {
    for (const [id, url] of Object.entries(photos)) await setItem(photoKey(id), url);
    if (privateSealed) await setItem(PRIVATE_KEY, privateSealed);
    closePrivate();
    photoKeyRef.current = null;
    setPhotosReady(false);
    setData({ ...emptyData(), ...d });
    setLocked(!!d.settings.lockHash);
  }, [closePrivate]);

  const value = useMemo<Store>(() => ({
    ready, data, profile, update, locked, unlock, setLock, lockNow,
    privateOpen, priv, privateEnabled: !!data.settings.privateSalt, enablePrivate, openPrivate, closePrivate, updatePrivate, privateSealedForBackup,
    savePhoto, loadPhoto, rawPhotos, photosReady, deletePhoto,
    relayAvailable, syncing, syncError, syncNow, sendCheer, shareChallenge, replaceAll,
  }), [ready, data, profile, update, locked, unlock, setLock, lockNow, privateOpen, priv, enablePrivate, openPrivate, closePrivate, updatePrivate, privateSealedForBackup, savePhoto, loadPhoto, rawPhotos, photosReady, deletePhoto, relayAvailable, syncing, syncError, syncNow, sendCheer, shareChallenge, replaceAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { newDeviceId, toB64, ymd };
