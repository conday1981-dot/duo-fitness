/**
 * Phone (iPhone app build) versions of files, photos, screen-awake and text
 * recognition (Apple Vision via expo-text-extractor). Same API as device.web.ts.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { extractTextFromImage } from 'expo-text-extractor';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

export interface PickedFile {
  name: string;
  text: string;
}

export async function pickTextFile(_accept?: string): Promise<PickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { name: a.name, text: await new File(a.uri).text() };
}

export async function pickImage(_maxSide?: number): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: false });
  if (r.canceled || !r.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${r.assets[0].base64}`;
}

export async function saveFile(name: string, content: string, mime: string): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const f = new File(Paths.cache, name);
    await f.write(content);
    await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export async function keepAwake(on: boolean): Promise<void> {
  if (on) await activateKeepAwakeAsync('duo-run');
  else deactivateKeepAwake('duo-run');
}

export const ocrEngine = 'Apple text recognition, on this phone';

export async function recognizeText(dataUrl: string): Promise<string> {
  const path = new File(Paths.cache, 'duo-ocr.jpg');
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = globalThis.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  await path.write(bytes);
  return (await extractTextFromImage(path.uri)).join('\n');
}

export const isWeb = false;

/** Spoken cue for runs (built-in iOS voice). */
export function speak(text: string): void {
  Speech.stop();
  Speech.speak(text, { rate: 1 });
}
