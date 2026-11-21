/**
 * Browser storage: IndexedDB, with an in-memory fallback when the browser
 * refuses storage (some sandboxed previews), so the app still runs.
 */
const DB = 'duo';
const STORE = 'kv';
let dbp: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, string>();

function db(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        if (!d) return resolve(undefined);
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function getItem(key: string): Promise<string | null> {
  if (!(await db())) return memory.get(key) ?? null;
  return ((await run<string>('readonly', (s) => s.get(key) as IDBRequest<string>)) ?? null);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!(await db())) return void memory.set(key, value);
  await run('readwrite', (s) => s.put(value, key));
}

export async function removeItem(key: string): Promise<void> {
  if (!(await db())) return void memory.delete(key);
  await run('readwrite', (s) => s.delete(key));
}

/** Home-screen web apps keep storage, but asking makes eviction less likely. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
