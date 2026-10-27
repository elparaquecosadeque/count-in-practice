import { Injectable } from '@angular/core';
import {
  BARS_MAX,
  BARS_MIN,
  BPM_MAX,
  BPM_MIN,
  BeatAccent,
  CountInSettings,
  defaultAccents, SILENCE_DB_MAX, SILENCE_DB_MIN, TIME_SIGNATURES, YOUTUBE_LEAD_MS_MAX, YOUTUBE_LEAD_MS_MIN } from '../models';

// Engine settings plus UI-only preferences that are worth remembering.
export interface StoredSettings extends CountInSettings {
  silenceThresholdDb: number;
  youtubeLeadMs: number;
}

const STORAGE_KEY = 'count-in-practice-settings';

const DEFAULTS: StoredSettings = {
  bpm: 100,
  beatsPerMeasure: 4,
  accents: defaultAccents(4),
  preCountBars: 1,
  countOutBars: 1,
  silenceThresholdDb: -40,
  youtubeLeadMs: 100,
};

// Stored data is untrusted (older versions, hand edits): any field that isn't
// an integer within the UI's own range falls back to its default.
function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback;
}

const ACCENTS: readonly unknown[] = ['strong', 'normal', 'mute'] satisfies BeatAccent[];

// Must fit the bar it's stored with; otherwise that bar's default pattern.
function accentsFor(value: unknown, beatsPerMeasure: number): BeatAccent[] {
  return Array.isArray(value) && value.length === beatsPerMeasure && value.every((a) => ACCENTS.includes(a))
    ? (value as BeatAccent[])
    : defaultAccents(beatsPerMeasure);
}

function load(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : null) as Partial<Record<keyof StoredSettings, unknown>> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULTS;
    const beatsPerMeasure = TIME_SIGNATURES.some((ts) => ts.beats === parsed.beatsPerMeasure)
      ? (parsed.beatsPerMeasure as number)
      : DEFAULTS.beatsPerMeasure;
    return {
      bpm: intInRange(parsed.bpm, BPM_MIN, BPM_MAX, DEFAULTS.bpm),
      beatsPerMeasure,
      accents: accentsFor(parsed.accents, beatsPerMeasure),
      preCountBars: intInRange(parsed.preCountBars, BARS_MIN, BARS_MAX, DEFAULTS.preCountBars),
      countOutBars: intInRange(parsed.countOutBars, BARS_MIN, BARS_MAX, DEFAULTS.countOutBars),
      silenceThresholdDb: intInRange(parsed.silenceThresholdDb, SILENCE_DB_MIN, SILENCE_DB_MAX, DEFAULTS.silenceThresholdDb),
      youtubeLeadMs: intInRange(parsed.youtubeLeadMs, YOUTUBE_LEAD_MS_MIN, YOUTUBE_LEAD_MS_MAX, DEFAULTS.youtubeLeadMs),
    };
  } catch {
    return DEFAULTS;
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsStorageService {
  load(): StoredSettings {
    return load();
  }

  save(settings: StoredSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or blocked (e.g. private mode) — settings just won't persist.
    }
  }
}
