/**
 * Encrypted backup (item 7). One file holding all fitness data, progress
 * photos, and the private section (still sealed with its own passcode).
 * The file is useless without the backup passphrase.
 */
import { deriveKey, newSalt, openJson, sealJson } from '../core/crypto';
import type { AppData } from '../core/types';

export interface BackupContents {
  data: AppData;
  photos: Record<string, string>; // id -> data URL
  privateSealed?: string;
}

export interface BackupFile {
  format: 'duo-backup';
  version: 1;
  createdAt: number;
  salt: string;
  box: string;
}

export async function makeBackup(contents: BackupContents, passphrase: string): Promise<string> {
  if (passphrase.length < 8) throw new Error('Use at least 8 characters for the backup passphrase.');
  const salt = newSalt();
  const key = await deriveKey(passphrase, salt);
  const file: BackupFile = { format: 'duo-backup', version: 1, createdAt: Date.now(), salt, box: sealJson(key, contents, 'duo-backup-v1') };
  return JSON.stringify(file);
}

export async function readBackup(text: string, passphrase: string): Promise<BackupContents> {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This isn\'t a DUO backup file.');
  }
  if (file.format !== 'duo-backup') throw new Error('This isn\'t a DUO backup file.');
  const key = await deriveKey(passphrase, file.salt);
  try {
    return openJson<BackupContents>(key, file.box, 'duo-backup-v1');
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.');
  }
}
