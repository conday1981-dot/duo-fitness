/**
 * DUO – phase 0 check app.
 *
 * Not the real app. It answers the questions the design doc (section 12) left
 * open, on the real phone, after installing through A.M.Y Loader:
 *   1. Does an unsigned Codemagic IPA install and open?
 *   2. Is HealthKit granted with free signing, and which apps (Fitdays?)
 *      write body readings to Apple Health?
 *   3. Can we get "Always" location for runs with the screen locked?
 *   4. Does on-device text recognition (Apple Vision) build and work?
 * "Copy report" puts every result on the clipboard to paste back to Claude.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Asset } from 'expo-asset';
import { extractTextFromImage, isSupported as ocrSupported } from 'expo-text-extractor';
import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

type Status = 'idle' | 'running' | 'pass' | 'warn' | 'fail';
type Result = { status: Status; lines: string[] };
type CheckId = 'install' | 'health' | 'location' | 'ocr';

const C = {
  bg: '#0E1116',
  card: '#161B22',
  text: '#E8EDF3',
  muted: '#8B97A6',
  accent: '#3DD6F5',
  pass: '#6FD99A',
  warn: '#F2A65A',
  fail: '#FF7B7B',
};

/** Body readings and the unit to read each one in. */
const HEALTH_TYPES = [
  ['HKQuantityTypeIdentifierBodyMass', 'kg', 'Weight'],
  ['HKQuantityTypeIdentifierBodyFatPercentage', '%', 'Body fat'],
  ['HKQuantityTypeIdentifierLeanBodyMass', 'kg', 'Lean body mass'],
  ['HKQuantityTypeIdentifierBodyMassIndex', 'count', 'BMI'],
  ['HKQuantityTypeIdentifierHeight', 'cm', 'Height'],
  ['HKQuantityTypeIdentifierWaistCircumference', 'cm', 'Waist'],
  ['HKQuantityTypeIdentifierStepCount', 'count', 'Steps'],
  ['HKQuantityTypeIdentifierRestingHeartRate', 'count/min', 'Resting heart rate'],
] as const;

const CHECKS: { id: CheckId; title: string; what: string }[] = [
  { id: 'install', title: '1. Build and install', what: 'If you can read this, the unsigned IPA installed and opened.' },
  { id: 'health', title: '2. Apple Health', what: 'Is HealthKit granted, and which apps write body readings?' },
  { id: 'location', title: '3. Location for runs', what: 'Asks for location, then "Always" so runs keep tracking when locked.' },
  { id: 'ocr', title: '4. Text recognition', what: 'Reads numbers from a test image on the phone, like a Fitdays screenshot.' },
];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 16).replace('T', ' ');

async function checkInstall(): Promise<Result> {
  return {
    status: 'pass',
    lines: [
      `App ${Application.applicationId ?? '?'} v${Application.nativeApplicationVersion ?? '?'} (build ${Application.nativeBuildVersion ?? '?'})`,
    ],
  };
}

async function checkHealth(): Promise<Result> {
  if (!isHealthDataAvailable()) return { status: 'fail', lines: ['Apple Health is not available on this device.'] };

  try {
    await withTimeout(requestAuthorization({ toRead: HEALTH_TYPES.map(([id]) => id) }), 120000, 'Health permission');
  } catch (e) {
    const msg = errText(e);
    const entitlement = /entitlement/i.test(msg);
    return {
      status: 'fail',
      lines: [
        `Permission request failed: ${msg}`,
        entitlement
          ? 'HealthKit is missing from this install\'s signature. A.M.Y Loader needs to switch on HealthKit for the app before signing.'
          : 'Not an entitlement error. Paste this report to Claude.',
      ],
    };
  }

  const lines: string[] = [];
  const allSources = new Set<string>();
  let anyData = false;
  for (const [id, unit, label] of HEALTH_TYPES) {
    try {
      const samples = await queryQuantitySamples(id as any, { limit: 50, ascending: false, unit: unit as any });
      if (!samples.length) {
        lines.push(`${label}: no readings (or read access off)`);
        continue;
      }
      anyData = true;
      const sources = [...new Set(samples.map((s) => s.sourceRevision?.source?.name ?? 'unknown'))];
      sources.forEach((s) => allSources.add(s));
      const latest = samples[0];
      lines.push(
        `${label}: ${Math.round(latest.quantity * 100) / 100} ${unit} at ${fmtDate(latest.startDate)} · from ${sources.join(', ')}`,
      );
    } catch (e) {
      lines.push(`${label}: error ${errText(e)}`);
    }
  }

  const fitdays = [...allSources].some((s) => /fitdays/i.test(s));
  lines.unshift(
    fitdays
      ? 'Fitdays IS writing to Apple Health.'
      : anyData
        ? 'Fitdays was NOT found as a source in the last 50 readings of each type.'
        : 'No readings came back. Either Health is empty, or read access was turned off in the permission sheet.',
  );
  return { status: fitdays ? 'pass' : 'warn', lines };
}

async function checkLocation(): Promise<Result> {
  const lines: string[] = [];
  if (!(await Location.hasServicesEnabledAsync())) {
    return { status: 'fail', lines: ['Location Services are off in Settings → Privacy & Security.'] };
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  lines.push(`While using: ${fg.status}`);
  if (fg.status !== 'granted') return { status: 'fail', lines };

  const bg = await Location.requestBackgroundPermissionsAsync();
  lines.push(`Always (screen locked): ${bg.status}`);

  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      20000,
      'Position',
    );
    lines.push(`Got a position, accuracy about ${Math.round(pos.coords.accuracy ?? -1)} m (not stored)`);
  } catch (e) {
    lines.push(`No position: ${errText(e)}`);
  }
  return { status: bg.status === 'granted' ? 'pass' : 'warn', lines };
}

async function checkOcr(): Promise<Result> {
  if (!ocrSupported) return { status: 'fail', lines: ['Text recognition is not supported on this device.'] };
  const asset = Asset.fromModule(require('./assets/ocr-sample.png'));
  await asset.downloadAsync();
  if (!asset.localUri) return { status: 'fail', lines: ['Could not load the test image.'] };
  const started = Date.now();
  const texts = await withTimeout(extractTextFromImage(asset.localUri), 30000, 'Text recognition');
  const joined = texts.join(' | ');
  const ok = joined.includes('88.1') && joined.includes('24.1');
  return {
    status: ok ? 'pass' : 'warn',
    lines: [`Read in ${Date.now() - started} ms: ${joined || '(nothing)'}`, ok ? 'Numbers read correctly.' : 'Expected 88.1 and 24.1.'],
  };
}

const RUNNERS: Record<CheckId, () => Promise<Result>> = {
  install: checkInstall,
  health: checkHealth,
  location: checkLocation,
  ocr: checkOcr,
};

export default function App() {
  const [results, setResults] = useState<Partial<Record<CheckId, Result>>>({});
  const [copied, setCopied] = useState(false);

  const run = useCallback(async (id: CheckId) => {
    setResults((r) => ({ ...r, [id]: { status: 'running', lines: [] } }));
    let res: Result;
    try {
      res = await RUNNERS[id]();
    } catch (e) {
      res = { status: 'fail', lines: [`Unexpected error: ${errText(e)}`] };
    }
    setResults((r) => ({ ...r, [id]: res }));
  }, []);

  const runAll = useCallback(async () => {
    // One at a time: each can show an iOS permission sheet.
    for (const c of CHECKS) await run(c.id);
  }, [run]);

  const copyReport = useCallback(async () => {
    const body = CHECKS.map((c) => {
      const r = results[c.id];
      return `${c.title}: ${r?.status ?? 'not run'}\n${(r?.lines ?? []).map((l) => `  ${l}`).join('\n')}`;
    }).join('\n');
    await Clipboard.setStringAsync(`DUO phase 0 report ${new Date().toISOString()}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [results]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.kicker}>DUO · phase 0</Text>
        <Text style={s.h1}>Phone checks</Text>
        <Text style={s.lead}>Run all four, then copy the report and paste it to Claude. Nothing is sent anywhere.</Text>

        <Pressable accessibilityRole="button" onPress={runAll} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
          <Text style={s.primaryText}>Run all checks</Text>
        </Pressable>

        {CHECKS.map((c) => {
          const r = results[c.id];
          const color = r ? { idle: C.muted, running: C.accent, pass: C.pass, warn: C.warn, fail: C.fail }[r.status] : C.muted;
          return (
            <View key={c.id} style={s.card}>
              <View style={s.row}>
                <Text style={s.title}>{c.title}</Text>
                <Text style={[s.badge, { color }]}>{r ? (r.status === 'running' ? 'running…' : r.status.toUpperCase()) : 'not run'}</Text>
              </View>
              <Text style={s.what}>{c.what}</Text>
              {r?.lines.map((l, i) => (
                <Text key={i} style={s.line} selectable>
                  {l}
                </Text>
              ))}
              <Pressable accessibilityRole="button" onPress={() => run(c.id)} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
                <Text style={s.secondaryText}>Run this check</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable accessibilityRole="button" onPress={copyReport} style={({ pressed }) => [s.secondary, s.copy, pressed && s.pressed]}>
          <Text style={s.secondaryText}>{copied ? 'Copied ✓' : 'Copy report'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 48, gap: 14 },
  kicker: { color: C.muted, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  h1: { color: C.text, fontSize: 30, fontWeight: '700' },
  lead: { color: C.muted, fontSize: 15, lineHeight: 21 },
  primary: { backgroundColor: C.accent, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: C.bg, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 17, fontWeight: '600' },
  badge: { fontSize: 13, fontWeight: '700' },
  what: { color: C.muted, fontSize: 14, lineHeight: 19 },
  line: { color: C.text, fontSize: 13, lineHeight: 19, fontFamily: 'Menlo' },
  secondary: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: '#2E3846', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { color: C.text, fontSize: 15 },
  copy: { marginTop: 8 },
});
