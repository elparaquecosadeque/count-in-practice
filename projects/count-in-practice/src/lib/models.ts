export interface TrimRange {
  start: number;
  end: number;
}

export type BeatAccent = 'strong' | 'normal' | 'mute';

// Downbeat strong, the rest normal.
export function defaultAccents(beatsPerMeasure: number): BeatAccent[] {
  return Array.from({ length: beatsPerMeasure }, (_, i) => (i === 0 ? 'strong' : 'normal'));
}

export interface CountInSettings {
  bpm: number;
  beatsPerMeasure: number;
  // One per beat of the bar.
  accents: BeatAccent[];
  preCountBars: number;
  countOutBars: number;
}

export type TransportState = 'idle' | 'playing' | 'paused';

export type Language = 'en' | 'es';

export type Theme = 'dark' | 'light';

export type AudioSource = 'file' | 'youtube';

// Single source for the ranges the UI allows; inputs, tap tempo, BPM detection
// and stored-settings validation all clamp against these.
export const BPM_MIN = 40;
export const BPM_MAX = 240;
export const BARS_MIN = 0;
export const BARS_MAX = 8;
export const SILENCE_DB_MIN = -80;
export const SILENCE_DB_MAX = -10;
export const YOUTUBE_LEAD_MS_MIN = 0;
export const YOUTUBE_LEAD_MS_MAX = 1000;

export const TIME_SIGNATURES = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
  { label: '7/8', beats: 7 },
] as const;
