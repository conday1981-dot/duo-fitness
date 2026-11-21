/**
 * On-phone storage (iPhone app build): one file per key in the app's
 * Documents folder, which iOS encrypts with the device passcode.
 * The browser build uses storage.web.ts (IndexedDB) with the same API.
 */
import { Directory, File, Paths } from 'expo-file-system';

const dir = new Directory(Paths.document, 'duo');

function fileFor(key: string): File {
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return new File(dir, `${key.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`);
}

export async function getItem(key: string): Promise<string | null> {
  const f = fileFor(key);
  return f.exists ? f.text() : null;
}

export async function setItem(key: string, value: string): Promise<void> {
  await fileFor(key).write(value);
}

export async function removeItem(key: string): Promise<void> {
  const f = fileFor(key);
  if (f.exists) f.delete();
}

/** Ask the OS to keep our data (browser only; files are already persistent). */
export async function requestPersistence(): Promise<boolean> {
  return true;
}
