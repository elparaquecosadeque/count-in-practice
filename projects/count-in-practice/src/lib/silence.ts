export type SilenceTrimMode = 'both' | 'start' | 'end';

export interface SoundBounds {
  start: number;
  end: number;
}

// Loudness is measured over short windows rather than per sample, so a single
// stray sample above the threshold doesn't count as "sound".
const WINDOW_SEC = 0.01;

// First and last moment (seconds) within [from, to) where any channel's RMS
// over a 10ms window reaches `thresholdDb` (dBFS, e.g. -40). null if the whole
// range stays below it. Takes plain channel arrays so it's testable without
// Web Audio (jsdom has none).
export function findSoundBounds(
  channels: Float32Array[],
  sampleRate: number,
  from: number,
  to: number,
  thresholdDb: number,
): SoundBounds | null {
  const length = channels[0]?.length ?? 0;
  const threshold = 10 ** (thresholdDb / 20);
  const win = Math.max(1, Math.round(sampleRate * WINDOW_SEC));
  const toSample = (t: number) => Math.max(0, Math.min(length, Math.round(t * sampleRate)));
  const s0 = toSample(from);
  const s1 = toSample(to);

  const isLoud = (i: number) => {
    const stop = Math.min(i + win, s1);
    for (const channel of channels) {
      let sum = 0;
      for (let j = i; j < stop; j++) sum += channel[j] * channel[j];
      if (Math.sqrt(sum / (stop - i)) >= threshold) return true;
    }
    return false;
  };

  let first = -1;
  for (let i = s0; i < s1; i += win) {
    if (isLoud(i)) {
      first = i;
      break;
    }
  }
  if (first < 0) return null;

  let last = first;
  for (let i = s0 + Math.floor((s1 - s0 - 1) / win) * win; i >= first; i -= win) {
    if (isLoud(i)) {
      last = Math.min(i + win, s1);
      break;
    }
  }
  return { start: first / sampleRate, end: last / sampleRate };
}
