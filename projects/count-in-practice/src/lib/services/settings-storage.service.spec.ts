import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsStorageService } from './settings-storage.service';

const KEY = 'count-in-practice-settings';
const DEFAULTS = { bpm: 100, beatsPerMeasure: 4, preCountBars: 1, countOutBars: 1 };

describe('SettingsStorageService', () => {
  const service = new SettingsStorageService();

  beforeEach(() => localStorage.clear());

  it('round-trips valid settings', () => {
    const settings = { bpm: 132, beatsPerMeasure: 3, preCountBars: 2, countOutBars: 0 };
    service.save(settings);
    expect(service.load()).toEqual(settings);
  });

  it('falls back per field for out-of-range or wrong-typed values', () => {
    localStorage.setItem(KEY, JSON.stringify({ bpm: 999, beatsPerMeasure: '4', preCountBars: 1.5, countOutBars: 3 }));
    expect(service.load()).toEqual({ ...DEFAULTS, countOutBars: 3 });
  });

  it('returns defaults for corrupt JSON', () => {
    localStorage.setItem(KEY, '{nope');
    expect(service.load()).toEqual(DEFAULTS);
  });
});
