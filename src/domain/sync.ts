/**
 * Buddy sync (design doc §7). The two phones share a 32-byte couple key,
 * swapped in person as a pairing code. The relay only ever sees:
 * a mailbox id (derived from the key), a device id, sizes and timing.
 *
 * Record kinds:
 *   snapshot  – this phone's shareable fitness summary (latest wins)
 *   cheer     – a cheer or nudge
 *   challenge – a joint challenge
 *   private   – private section log/wish/date updates (separate sub-key)
 */
import { fromB64, hashHex, newKey, openJson, sealJson, subKey, toB64 } from '../core/crypto';
import { uid } from '../core/util';

export type RecordKind = 'snapshot' | 'cheer' | 'challenge' | 'private';

export interface Envelope {
  id: string;
  kind: RecordKind;
  from: string; // device id
  at: number;
  blob: string; // sealed JSON
}

export interface Relayed extends Envelope {
  seq: number;
}

export function newPairing(deviceId: string) {
  const coupleKey = newKey();
  return { coupleKey, mailbox: mailboxFor(coupleKey), deviceId, pairedAt: Date.now() };
}

export const mailboxFor = (coupleKey: string) => hashHex(`duo-mailbox:${coupleKey}`).slice(0, 32);

/** Pairing code = "DUO1." + key + "." + 4-char check, so a typo is caught. */
export function pairingCode(coupleKey: string): string {
  return `DUO1.${coupleKey}.${hashHex(coupleKey).slice(0, 4)}`;
}

export function parsePairingCode(code: string): string {
  const m = /DUO1\.([A-Za-z0-9_-]{43})\.([0-9a-f]{4})/.exec(code.trim());
  if (!m) throw new Error('That doesn\'t look like a DUO pairing code.');
  if (hashHex(m[1]).slice(0, 4) !== m[2]) throw new Error('The code is incomplete or has a typo. Copy it again.');
  if (fromB64(m[1]).length !== 32) throw new Error('The code is the wrong length.');
  return m[1];
}

const keyFor = (coupleKey: string, kind: RecordKind) => subKey(fromB64(coupleKey), kind === 'private' ? 'private' : 'fitness');

export function wrap(coupleKey: string, deviceId: string, kind: RecordKind, body: unknown): Envelope {
  const id = uid();
  const at = Date.now();
  return { id, kind, from: deviceId, at, blob: sealJson(keyFor(coupleKey, kind), body, `${kind}:${id}:${deviceId}`) };
}

/** Returns undefined for anything that fails to decrypt (wrong key or tampered). */
export function unwrap<T>(coupleKey: string, e: Envelope): T | undefined {
  try {
    return openJson<T>(keyFor(coupleKey, e.kind), e.blob, `${e.kind}:${e.id}:${e.from}`);
  } catch {
    return undefined;
  }
}

export const newDeviceId = () => toB64(fromB64(newKey()).subarray(0, 12));

export interface RelayClient {
  push(mailbox: string, records: Envelope[]): Promise<void>;
  pull(mailbox: string, after: number, notFrom: string): Promise<Relayed[]>;
}

export function httpRelay(base: string): RelayClient {
  const url = (m: string) => `${base.replace(/\/$/, '')}/api/v1/mailbox/${m}`;
  return {
    async push(mailbox, records) {
      const r = await fetch(url(mailbox), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records }) });
      if (!r.ok) throw new Error(`Sync upload failed (${r.status})`);
    },
    async pull(mailbox, after, notFrom) {
      const r = await fetch(`${url(mailbox)}?after=${after}&not=${encodeURIComponent(notFrom)}`);
      if (!r.ok) throw new Error(`Sync download failed (${r.status})`);
      return ((await r.json()) as { records: Relayed[] }).records;
    },
  };
}
