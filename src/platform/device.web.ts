/**
 * Browser versions of the phone features: files, photos, screen wake lock,
 * and text recognition (Tesseract, bundled with the app, runs on the phone).
 */
export interface PickedFile {
  name: string;
  text: string;
}

function pick(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function pickTextFile(accept = '.gpx,.json,application/json,application/gpx+xml,text/xml'): Promise<PickedFile | null> {
  const f = await pick(accept);
  return f ? { name: f.name, text: await f.text() } : null;
}

/** Pick a photo and shrink it (longest side 1280 px, JPEG) so storage stays small. */
export async function pickImage(maxSide = 1280): Promise<string | null> {
  const f = await pick('image/*');
  if (!f) return null;
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Save a file: the share sheet on iPhone (Save to Files, AirDrop), else a download. */
export async function saveFile(name: string, content: string, mime: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const file = new File([content], name, { type: mime });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

let lock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && !lock) lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null; // not supported (older iOS) or refused
  }
}

/* ---------- text recognition ---------- */

type TWorker = { recognize: (img: string) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> };
let workerP: Promise<TWorker> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load text recognition.'));
    document.head.appendChild(s);
  });
}

function base(): string {
  return new URL('./ocr/', document.baseURI).href;
}

async function worker(): Promise<TWorker> {
  if (!workerP) {
    workerP = (async () => {
      const w = window as unknown as { Tesseract?: { createWorker: (lang: string, oem: number, opts: object) => Promise<TWorker> } };
      if (!w.Tesseract) await loadScript(`${base()}tesseract.min.js`);
      return w.Tesseract!.createWorker('eng', 1, { workerPath: `${base()}worker.min.js`, corePath: base(), langPath: base(), gzip: true, workerBlobURL: false });
    })().catch((e) => {
      workerP = null;
      throw e;
    });
  }
  return workerP;
}

export const ocrEngine = 'Text recognition in your browser (Tesseract), on this phone';

export async function recognizeText(dataUrl: string): Promise<string> {
  const w = await worker();
  return (await w.recognize(dataUrl)).data.text;
}

export const isWeb = true;

/** Spoken cue for runs (built-in voice). */
export function speak(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}
