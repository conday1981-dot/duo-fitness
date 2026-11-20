/**
 * Browser preview of the phase 0 checks.
 *
 * Browsers have no HealthKit, background GPS or Apple Vision, so these return
 * simulated results shaped like the real ones. The screens and flow are the
 * same as on the phone. Every line says SIMULATED so nobody mistakes it for
 * a real test.
 */
import type { CheckId, Result } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const RUNNERS: Record<CheckId, () => Promise<Result>> = {
  async install() {
    await wait(200);
    return { status: 'pass', lines: ['SIMULATED: browser preview, nothing installed'] };
  },
  async health() {
    await wait(900);
    return {
      status: 'warn',
      lines: [
        'SIMULATED: on the phone this asks for Apple Health access and lists real readings.',
        'Weight: 88.1 kg at 2026-11-20 07:01 · from Fitdays (example)',
        'Body fat: 24.1 % at 2026-11-20 07:01 · from Fitdays (example)',
        'Steps: 412 count at 2026-11-20 09:30 · from iPhone (example)',
      ],
    };
  },
  async location() {
    await wait(700);
    return {
      status: 'warn',
      lines: ['SIMULATED: on the phone this asks for "While using", then "Always" location.'],
    };
  },
  async ocr() {
    await wait(600);
    return {
      status: 'warn',
      lines: ['SIMULATED: on the phone this reads the test image with Apple Vision.', 'Example: Weight | 88.1 kg | Body fat | 24.1 %'],
    };
  },
};
