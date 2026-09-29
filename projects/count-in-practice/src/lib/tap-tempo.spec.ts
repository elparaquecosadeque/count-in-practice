import { describe, expect, it } from 'vitest';
import { createTapTempoState, registerTap } from './tap-tempo';

describe('registerTap', () => {
  it('returns null bpm on the first tap', () => {
    const { bpm } = registerTap(createTapTempoState(), 0);
    expect(bpm).toBeNull();
  });

  it('computes bpm from the interval between two taps', () => {
    let { state } = registerTap(createTapTempoState(), 0);
    const result = registerTap(state, 500); // 500ms interval -> 120 bpm
    expect(result.bpm).toBe(120);
  });

  it('averages several intervals', () => {
    let s = createTapTempoState();
    let bpm: number | null = null;
    for (const t of [0, 500, 1000, 1500]) {
      const result = registerTap(s, t);
      s = result.state;
      bpm = result.bpm;
    }
    expect(bpm).toBe(120);
  });

  it('starts a fresh run after a long pause', () => {
    let { state } = registerTap(createTapTempoState(), 0);
    state = registerTap(state, 500).state; // 120 bpm run
    // Nothing for >2s, then two taps 1000ms apart (60 bpm) — the old run must not skew this.
    const result = registerTap(state, 3000);
    expect(result.bpm).toBeNull(); // fresh run, only one tap so far
    const final = registerTap(result.state, 4000);
    expect(final.bpm).toBe(60);
  });

  it('clamps to the supported bpm range', () => {
    let { state } = registerTap(createTapTempoState(), 0);
    const tooFast = registerTap(state, 50); // 50ms interval -> 1200 bpm, clamps to 240
    expect(tooFast.bpm).toBe(240);
  });
});
