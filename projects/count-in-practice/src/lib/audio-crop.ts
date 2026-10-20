export interface CropRange {
  start: number;
  length: number;
}

// Pure sample-index math for "keep only [start, end)". Times in seconds; clamps
// to the buffer and orders the bounds so a region dragged slightly out of range
// never produces a negative-length copy.
export function computeCropRange(sampleRate: number, bufferLength: number, start: number, end: number): CropRange {
  const toSample = (t: number) => Math.max(0, Math.min(bufferLength, Math.round(t * sampleRate)));
  const s = toSample(start);
  const e = Math.max(s, toSample(end));
  return { start: s, length: e - s };
}

// Thin application of the math above onto a real AudioBuffer — not unit-tested
// itself (jsdom has no Web Audio API), the logic worth testing lives in
// computeCropRange above.
export function cropAudioBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const range = computeCropRange(buffer.sampleRate, buffer.length, start, end);
  const result = new AudioBuffer({
    length: Math.max(1, range.length),
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    result.copyToChannel(buffer.getChannelData(channel).subarray(range.start, range.start + range.length), channel);
  }
  return result;
}
