import { BPM_MAX, BPM_MIN } from './models';

export interface TapTempoState {
  tapTimes: number[];
}

const RESET_MS = 2000;
const WINDOW = 8;

export function createTapTempoState(): TapTempoState {
  return { tapTimes: [] };
}

// Registers a tap at `now` (ms). Starts a fresh run if more than RESET_MS has
// passed since the last tap. bpm is null until there are at least two taps to
// measure an interval from; a sliding window keeps a stray early tap from
// permanently skewing the average.
export function registerTap(state: TapTempoState, now: number): { state: TapTempoState; bpm: number | null } {
  const last = state.tapTimes[state.tapTimes.length - 1];
  const resetting = last !== undefined && now - last > RESET_MS;
  const tapTimes = [...(resetting ? [] : state.tapTimes), now].slice(-WINDOW);

  if (tapTimes.length < 2) {
    return { state: { tapTimes }, bpm: null };
  }

  const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
  const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / avgMs)));
  return { state: { tapTimes }, bpm };
}
