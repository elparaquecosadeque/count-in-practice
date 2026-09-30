export interface SpliceRange {
  start: number;
  length: number;
}

export interface SpliceRanges {
  firstPart: SpliceRange;
  secondPart: SpliceRange;
  totalLength: number;
}

// Pure sample-index math for "keep [keepStart, cutStart), drop [cutStart, cutEnd),
// keep [cutEnd, keepEnd)" — i.e. cut a chunk out of the middle of the kept range
// and splice the two remaining pieces together. All times in seconds; clamps and
// orders everything so a region dragged slightly out of bounds (or a cut wider
// than the kept range) never produces a negative-length copy.
export function computeSpliceRanges(
  sampleRate: number,
  bufferLength: number,
  keepStart: number,
  cutStart: number,
  cutEnd: number,
  keepEnd: number,
): SpliceRanges {
  const toSample = (t: number) => Math.max(0, Math.min(bufferLength, Math.round(t * sampleRate)));
  const ks = toSample(keepStart);
  const cs = Math.max(ks, toSample(cutStart));
  const ce = Math.max(cs, toSample(cutEnd));
  const ke = Math.max(ce, toSample(keepEnd));
  const firstLength = cs - ks;
  const secondLength = ke - ce;
  return {
    firstPart: { start: ks, length: firstLength },
    secondPart: { start: ce, length: secondLength },
    totalLength: firstLength + secondLength,
  };
}

// Thin application of the math above onto a real AudioBuffer — not unit-tested
// itself (jsdom has no Web Audio API), the logic worth testing lives in
// computeSpliceRanges above.
export function spliceAudioBuffer(
  buffer: AudioBuffer,
  keepStart: number,
  cutStart: number,
  cutEnd: number,
  keepEnd: number,
): AudioBuffer {
  const ranges = computeSpliceRanges(buffer.sampleRate, buffer.length, keepStart, cutStart, cutEnd, keepEnd);
  const result = new AudioBuffer({
    length: Math.max(1, ranges.totalLength),
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const src = buffer.getChannelData(channel);
    const dst = result.getChannelData(channel);
    dst.set(src.subarray(ranges.firstPart.start, ranges.firstPart.start + ranges.firstPart.length), 0);
    dst.set(src.subarray(ranges.secondPart.start, ranges.secondPart.start + ranges.secondPart.length), ranges.firstPart.length);
  }
  return result;
}
