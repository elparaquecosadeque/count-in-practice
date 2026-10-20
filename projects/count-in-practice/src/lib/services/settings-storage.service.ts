import { Injectable } from '@angular/core';
import { CountInSettings } from '../models';

const STORAGE_KEY = 'count-in-practice-settings';

const DEFAULTS: CountInSettings = {
  bpm: 100,
  beatsPerMeasure: 4,
  preCountBars: 1,
  countOutBars: 1,
};

// Stored data is untrusted (older versions, hand edits): any field that isn't
// an integer within the UI's own range falls back to its default.
function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback;
}

function load(): CountInSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : null) as Partial<Record<keyof CountInSettings, unknown>> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULTS;
    return {
      bpm: intInRange(parsed.bpm, 40, 240, DEFAULTS.bpm),
      beatsPerMeasure: intInRange(parsed.beatsPerMeasure, 2, 7, DEFAULTS.beatsPerMeasure),
      preCountBars: intInRange(parsed.preCountBars, 0, 8, DEFAULTS.preCountBars),
      countOutBars: intInRange(parsed.countOutBars, 0, 8, DEFAULTS.countOutBars),
    };
  } catch {
    return DEFAULTS;
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsStorageService {
  load(): CountInSettings {
    return load();
  }

  save(settings: CountInSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or blocked (e.g. private mode) — settings just won't persist.
    }
  }
}
