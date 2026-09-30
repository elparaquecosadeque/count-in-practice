// A structural subset of AudioBuffer — lets encodeWav be unit-tested with a
// plain mock object, since jsdom has no real Web Audio API to construct one.
export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2; // 16-bit PCM

// wavesurfer.loadBlob() needs a real Blob to hand its underlying <audio>
// element, even though our own playback engine never touches it — a plain
// uncompressed WAV is the simplest format to write ourselves, no encoder
// dependency needed.
export function encodeWav(source: PcmSource): ArrayBuffer {
  const { numberOfChannels, sampleRate, length } = source;
  const blockAlign = numberOfChannels * BYTES_PER_SAMPLE;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < numberOfChannels; channel++) channels.push(source.getChannelData(channel));

  let offset = HEADER_BYTES;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
      offset += BYTES_PER_SAMPLE;
    }
  }

  return buffer;
}
