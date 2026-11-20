export type Status = 'idle' | 'running' | 'pass' | 'warn' | 'fail';
export type Result = { status: Status; lines: string[] };
export type CheckId = 'install' | 'health' | 'location' | 'ocr';


export const CHECKS: { id: CheckId; title: string; what: string }[] = [
  { id: 'install', title: '1. Build and install', what: 'If you can read this, the unsigned IPA installed and opened.' },
  { id: 'health', title: '2. Apple Health', what: 'Is HealthKit granted, and which apps write body readings?' },
  { id: 'location', title: '3. Location for runs', what: 'Asks for location, then "Always" so runs keep tracking when locked.' },
  { id: 'ocr', title: '4. Text recognition', what: 'Reads numbers from a test image on the phone, like a Fitdays screenshot.' },
];

