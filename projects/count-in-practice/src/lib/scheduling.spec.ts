import { describe, expect, it } from 'vitest';
import { audioSlotBars, audioStartOffset, barDuration, cycleDuration, phaseAt } from './scheduling';

// 120 BPM, 4/4 -> beat = 0.5s, bar = 2s.
const base = { bpm: 120, beatsPerMeasure: 4, preCountBars: 1, countOutBars: 1, audioDuration: 3 };

describe('audioSlotBars', () => {
  it('rounds up a partial bar to a whole bar', () => {
    // 3s of audio / 2s bar = 1.5 bars -> rounds up to 2.
    expect(audioSlotBars(3, 120, 4)).toBe(2);
  });

  it('returns 0 when there is no audio yet', () => {
    expect(audioSlotBars(0, 120, 4)).toBe(0);
  });

  it('never returns less than 1 bar for nonzero audio', () => {
    expect(audioSlotBars(0.1, 120, 4)).toBe(1);
  });
});

describe('cycleDuration', () => {
  it('sums preCount + rounded audio slot + countOut, in bars', () => {
    // 1 (preCount) + 2 (audio slot) + 1 (countOut) = 4 bars * 2s = 8s.
    expect(cycleDuration(base)).toBe(8);
  });
});

describe('audioStartOffset', () => {
  it('is preCountBars worth of bars', () => {
    expect(audioStartOffset(base)).toBe(barDuration(120, 4) * base.preCountBars);
  });
});

describe('phaseAt', () => {
  it('reports preCount for time within the pre-count bars', () => {
    const pos = phaseAt(0.5, base);
    expect(pos.phase).toBe('preCount');
    expect(pos.beatIndex).toBe(1);
    expect(pos.barInPhase).toBe(1);
    expect(pos.barsInPhase).toBe(1);
  });

  it('reports audio once past the pre-count bars, even mid-bar', () => {
    // preCount ends at 2s; audio slot is 2 bars (4s) covering the 3s of real audio.
    const pos = phaseAt(2.5, base);
    expect(pos.phase).toBe('audio');
    expect(pos.barInPhase).toBe(1);
    expect(pos.barsInPhase).toBe(2);
  });

  it('reports audio phase still active in the trailing silent fill bar', () => {
    // 3s of real audio ends at 5s (2+3), but the reserved slot runs to 6s.
    const pos = phaseAt(5.5, base);
    expect(pos.phase).toBe('audio');
    expect(pos.barInPhase).toBe(2);
  });

  it('reports countOut starting exactly on the downbeat after the audio slot', () => {
    // preCount (2s) + audio slot (4s) = 6s.
    const pos = phaseAt(6, base);
    expect(pos.phase).toBe('countOut');
    expect(pos.beatIndex).toBe(0);
    expect(pos.isAccent).toBe(true);
    expect(pos.barInPhase).toBe(1);
    expect(pos.barsInPhase).toBe(1);
  });

  it('marks beat 0 of every bar as the accent beat', () => {
    expect(phaseAt(0, base).isAccent).toBe(true);
    expect(phaseAt(0.5, base).isAccent).toBe(false);
  });
});
