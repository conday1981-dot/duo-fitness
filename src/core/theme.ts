import type { ThemeName } from './types';

export interface Palette {
  bg: string;
  card: string;
  raised: string;
  line: string;
  text: string;
  soft: string;
  muted: string;
  accent: string;
  onAccent: string;
  good: string;
  warn: string;
  bad: string;
  partner: string;
}

const shared = { good: '#6FD99A', warn: '#F2A65A', bad: '#FF7B7B' };

/** Con: graphite + cyan. Honey: Bloom's palette (gold on warm dark). */
export const palettes: Record<ThemeName, Palette> = {
  con: {
    bg: '#0E1116', card: '#161B22', raised: '#1E2530', line: '#2E3846',
    text: '#E8EDF3', soft: '#B8C2CE', muted: '#8B97A6',
    accent: '#3DD6F5', onAccent: '#0E1116', partner: '#F5C400', ...shared,
  },
  honey: {
    bg: '#0E0B00', card: '#1A1505', raised: '#261F0A', line: '#3A3015',
    text: '#F3EEDC', soft: '#C2B998', muted: '#A39A80',
    accent: '#F5C400', onAccent: '#0E0B00', partner: '#3DD6F5', ...shared,
  },
};

/** The private section always uses the honey palette (design doc §2). */
export const privatePalette = palettes.honey;

export const radius = { s: 10, m: 16, l: 22 };
export const space = (n: number) => n * 4;
