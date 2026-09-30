import { describe, expect, it } from 'vitest';
import { encodeWav, PcmSource } from './wav-encoder';

function readString(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

describe('encodeWav', () => {
  it('writes a valid RIFF/WAVE header matching the source format', () => {
    const source: PcmSource = {
      numberOfChannels: 2,
      sampleRate: 44100,
      length: 10,
      getChannelData: () => new Float32Array(10),
    };
    const buffer = encodeWav(source);
    const view = new DataView(buffer);

    expect(readString(view, 0, 4)).toBe('RIFF');
    expect(readString(view, 8, 4)).toBe('WAVE');
    expect(readString(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(22, true)).toBe(2); // numberOfChannels
    expect(view.getUint32(24, true)).toBe(44100); // sampleRate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(readString(view, 36, 4)).toBe('data');

    const expectedDataSize = 10 * 2 * 2; // frames * channels * bytesPerSample
    expect(view.getUint32(40, true)).toBe(expectedDataSize);
    expect(buffer.byteLength).toBe(44 + expectedDataSize);
  });

  it('round-trips sample values through 16-bit PCM within quantization error', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const source: PcmSource = {
      numberOfChannels: 1,
      sampleRate: 8000,
      length: samples.length,
      getChannelData: () => samples,
    };
    const view = new DataView(encodeWav(source));

    for (let i = 0; i < samples.length; i++) {
      const int16 = view.getInt16(44 + i * 2, true);
      const decoded = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
      expect(decoded).toBeCloseTo(samples[i], 3);
    }
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const samples = new Float32Array([2, -2]);
    const source: PcmSource = {
      numberOfChannels: 1,
      sampleRate: 8000,
      length: samples.length,
      getChannelData: () => samples,
    };
    const view = new DataView(encodeWav(source));
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});
