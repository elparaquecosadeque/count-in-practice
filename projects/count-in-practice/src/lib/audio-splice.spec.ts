import { describe, expect, it } from 'vitest';
import { computeSpliceRanges } from './audio-splice';

// 10 samples/sec for easy-to-read numbers: keep [0,1)s = samples 0-9, cut [0.4,0.6)s
// = samples 4-5, keep up to 1s = sample 10.
describe('computeSpliceRanges', () => {
  it('splits into a first part before the cut and a second part after it', () => {
    const result = computeSpliceRanges(10, 100, 0, 0.4, 0.6, 1);
    expect(result.firstPart).toEqual({ start: 0, length: 4 });
    expect(result.secondPart).toEqual({ start: 6, length: 4 });
    expect(result.totalLength).toBe(8);
  });

  it('produces a length equal to the kept span minus the cut span', () => {
    const result = computeSpliceRanges(10, 100, 2, 3, 5, 8);
    // kept span = 6s (60 samples), cut span = 2s (20 samples) -> 40 samples left.
    expect(result.totalLength).toBe(40);
  });

  it('clamps a cut that starts before the kept range to the kept start', () => {
    const result = computeSpliceRanges(10, 100, 1, 0, 1.5, 3);
    expect(result.firstPart).toEqual({ start: 10, length: 0 });
    expect(result.secondPart).toEqual({ start: 15, length: 15 });
  });

  it('produces an empty second part when the cut runs past the kept end', () => {
    const result = computeSpliceRanges(10, 100, 0, 1, 5, 2);
    // The cut itself extends beyond keepEnd, so nothing is left to keep after it.
    expect(result.secondPart.length).toBe(0);
    expect(result.firstPart).toEqual({ start: 0, length: 10 });
    expect(result.totalLength).toBe(10);
  });

  it('never produces a negative-length part when cutStart > cutEnd', () => {
    const result = computeSpliceRanges(10, 100, 0, 0.8, 0.3, 1);
    expect(result.firstPart.length).toBeGreaterThanOrEqual(0);
    expect(result.secondPart.length).toBeGreaterThanOrEqual(0);
  });
});
