export interface TrimRange {
  start: number;
  end: number;
}

export interface CountInSettings {
  bpm: number;
  beatsPerMeasure: number;
  preCountBars: number;
  countOutBars: number;
}

export type TransportState = 'idle' | 'playing' | 'paused';

export type Language = 'en' | 'es';
