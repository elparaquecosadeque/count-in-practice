import { Injectable } from '@angular/core';
import { CountInSettings } from '../models';

const STORAGE_KEY = 'count-in-practice-settings';

const DEFAULTS: CountInSettings = {
  bpm: 100,
  beatsPerMeasure: 4,
  preCountBars: 1,
  countOutBars: 1,
};

function load(): CountInSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? { ...DEFAULTS, ...(parsed as Partial<CountInSettings>) } : DEFAULTS;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}
