/** Phase 0 checks on the phone. The browser preview uses checks.web.ts instead. */
import * as Application from 'expo-application';
import * as Location from 'expo-location';
import { Asset } from 'expo-asset';
import { extractTextFromImage, isSupported as ocrSupported } from 'expo-text-extractor';
import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { CheckId, Result } from './types';

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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
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
  const asset = Asset.fromModule(require('../assets/ocr-sample.png'));
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

export const RUNNERS: Record<CheckId, () => Promise<Result>> = {
  install: checkInstall,
  health: checkHealth,
  location: checkLocation,
  ocr: checkOcr,
};

