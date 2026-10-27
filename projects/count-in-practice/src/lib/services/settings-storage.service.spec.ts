import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsStorageService, StoredSettings } from './settings-storage.service';

const KEY = 'count-in-practice-settings';
const DEFAULTS = { bpm: 100, beatsPerMeasure: 4, accents: ['strong', 'normal', 'normal', 'normal'], preCountBars: 1, countOutBars: 1, silenceThresholdDb: -40, youtubeLeadMs: 100 };

describe('SettingsStorageService', () => {
  const service = new SettingsStorageService();

  beforeEach(() => localStorage.clear());

  it('round-trips valid settings', () => {
    const settings: StoredSettings = { bpm: 132, beatsPerMeasure: 3, accents: ['strong', 'mute', 'normal'], preCountBars: 2, countOutBars: 0, silenceThresholdDb: -55, youtubeLeadMs: 250 };
    service.save(settings);
    expect(service.load()).toEqual(settings);
  });

  it('falls back per field for out-of-range or wrong-typed values', () => {
    localStorage.setItem(KEY, JSON.stringify({ bpm: 999, beatsPerMeasure: '4', preCountBars: 1.5, countOutBars: 3, silenceThresholdDb: 0, youtubeLeadMs: -5 }));
    expect(service.load()).toEqual({ ...DEFAULTS, countOutBars: 3 });
  });

  it("resets accents that don't fit the stored bar", () => {
    localStorage.setItem(KEY, JSON.stringify({ beatsPerMeasure: 3, accents: ['strong', 'normal', 'normal', 'normal'] }));
    expect(service.load().accents).toEqual(['strong', 'normal', 'normal']);
    localStorage.setItem(KEY, JSON.stringify({ beatsPerMeasure: 2, accents: ['loud', 'normal'] }));
    expect(service.load().accents).toEqual(['strong', 'normal']);
  });

  it('returns defaults for corrupt JSON', () => {
    localStorage.setItem(KEY, '{nope');
    expect(service.load()).toEqual(DEFAULTS);
  });
});
