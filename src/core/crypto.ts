/**
 * Encryption used everywhere in DUO (design doc §7, §9):
 * - XChaCha20-Poly1305 for anything sealed (private section, backups, sync)
 * - scrypt to turn a passcode into a key
 * Pure JS (noble), so it behaves the same in the browser and on the phone.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { bytesToUtf8 } from '@noble/ciphers/utils.js';

export { randomBytes };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[=\s]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c = [0, 1, 2, 3].map((j) => (i + j < clean.length ? B64.indexOf(clean[i + j]) : 0));
    if (c.some((v) => v < 0)) throw new Error('Not valid base64');
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return new Uint8Array(out);
}

/** Passcode → 32-byte key. N=2^15 takes well under a second on a phone. */
export async function deriveKey(passcode: string, saltB64: string): Promise<Uint8Array> {
  return scryptAsync(utf8ToBytes(passcode), fromB64(saltB64), { N: 2 ** 15, r: 8, p: 1, dkLen: 32 });
}

export const newSalt = () => toB64(randomBytes(16));
export const newKey = () => toB64(randomBytes(32));

/** Seal: 24-byte nonce + ciphertext, base64url. */
export function seal(key: Uint8Array, plaintext: string, aad?: string): string {
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce, aad ? utf8ToBytes(aad) : undefined).encrypt(utf8ToBytes(plaintext));
  const box = new Uint8Array(24 + ct.length);
  box.set(nonce);
  box.set(ct, 24);
  return toB64(box);
}

/** Throws if the key is wrong or the data was changed. */
export function open(key: Uint8Array, sealed: string, aad?: string): string {
  const box = fromB64(sealed);
  const pt = xchacha20poly1305(key, box.subarray(0, 24), aad ? utf8ToBytes(aad) : undefined).decrypt(box.subarray(24));
  return bytesToUtf8(pt);
}

export const sealJson = (key: Uint8Array, v: unknown, aad?: string) => seal(key, JSON.stringify(v), aad);
export const openJson = <T>(key: Uint8Array, s: string, aad?: string): T => JSON.parse(open(key, s, aad));

/** Labelled sub-key from a master key (HKDF-lite with HMAC-SHA256). */
export function subKey(master: Uint8Array, label: string): Uint8Array {
  return hmac(sha256, master, utf8ToBytes(`duo/${label}`));
}

export const hashHex = (s: string) => Array.from(sha256(utf8ToBytes(s)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Passcode check value stored for the app lock (never the passcode itself). */
export async function passcodeHash(passcode: string, saltB64: string): Promise<string> {
  return toB64(subKey(await deriveKey(passcode, saltB64), 'lock-check'));
}
