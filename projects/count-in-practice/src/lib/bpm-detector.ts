import { guess } from 'web-audio-beat-detector';

const BPM_MIN = 40;
const BPM_MAX = 240;

// Detects tempo against the current trim region (not the whole file) so a long
// intro/outro without a clear pulse doesn't throw off the estimate.
export async function detectBpm(buffer: AudioBuffer, offset: number, duration: number): Promise<number> {
  const { bpm } = await guess(buffer, offset, Math.max(0.1, duration));
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}
