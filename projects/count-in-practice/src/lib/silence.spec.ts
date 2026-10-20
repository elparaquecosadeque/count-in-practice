import { describe, expect, it } from 'vitest';
import { findSoundBounds } from './silence';

// 100 samples/sec -> 1-sample windows, so seconds map to samples / 100.
const SR = 100;

// `segments` of [seconds, amplitude] laid end to end.
function signal(...segments: [number, number][]): Float32Array {
  const out: number[] = [];
  for (const [seconds, amp] of segments) for (let i = 0; i < seconds * SR; i++) out.push(amp);
  return Float32Array.from(out);
}

describe('findSoundBounds', () => {
  const quiet = 0.001; // -60 dBFS
  const loud = 0.5; // ~-6 dBFS

  it('finds where sound starts and stops between leading and trailing silence', () => {
    const ch = signal([1, quiet], [2, loud], [1, quiet]);
    expect(findSoundBounds([ch], SR, 0, 4, -40)).toEqual({ start: 1, end: 3 });
  });

  it('only looks inside the given range', () => {
    const ch = signal([1, loud], [1, quiet], [1, loud], [1, quiet]);
    expect(findSoundBounds([ch], SR, 1, 4, -40)).toEqual({ start: 2, end: 3 });
  });

  it('counts sound on any channel', () => {
    const left = signal([3, quiet]);
    const right = signal([1, quiet], [1, loud], [1, quiet]);
    expect(findSoundBounds([left, right], SR, 0, 3, -40)).toEqual({ start: 1, end: 2 });
  });

  it('returns null when nothing reaches the threshold', () => {
    const ch = signal([2, quiet]);
    expect(findSoundBounds([ch], SR, 0, 2, -40)).toBeNull();
  });

  it('respects the threshold: a lower one treats quiet noise as sound', () => {
    const ch = signal([1, 0], [1, quiet], [1, loud]);
    expect(findSoundBounds([ch], SR, 0, 3, -70)).toEqual({ start: 1, end: 3 });
  });
});
