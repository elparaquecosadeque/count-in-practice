import { describe, expect, it } from 'vitest';
import { computeCropRange } from './audio-crop';

// 10 samples/sec for easy-to-read numbers.
describe('computeCropRange', () => {
  it('keeps only the samples inside the selection', () => {
    expect(computeCropRange(10, 100, 2, 5)).toEqual({ start: 20, length: 30 });
  });

  it('clamps a selection that runs past either end of the buffer', () => {
    expect(computeCropRange(10, 100, -1, 50)).toEqual({ start: 0, length: 100 });
  });

  it('never produces a negative length when start > end', () => {
    expect(computeCropRange(10, 100, 5, 2)).toEqual({ start: 50, length: 0 });
  });
});
