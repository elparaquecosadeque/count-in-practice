export type Phase = 'preCount' | 'audio' | 'countOut';

export interface CycleConfig {
  bpm: number;
  beatsPerMeasure: number;
  preCountBars: number;
  countOutBars: number;
  audioDuration: number;
}

export interface PhasePosition {
  phase: Phase;
  beatIndex: number;
  isAccent: boolean;
  barInPhase: number;
  barsInPhase: number;
}

export function beatDuration(bpm: number): number {
  return 60 / bpm;
}

export function barDuration(bpm: number, beatsPerMeasure: number): number {
  return beatsPerMeasure * beatDuration(bpm);
}

// The audio phase always reserves a whole number of bars, rounded up, so the
// Count-Out phase that follows always starts exactly on a downbeat — no
// separate "wait for the next bar" logic needed anywhere else.
export function audioSlotBars(audioDuration: number, bpm: number, beatsPerMeasure: number): number {
  if (audioDuration <= 0) return 0;
  return Math.max(1, Math.ceil(audioDuration / barDuration(bpm, beatsPerMeasure)));
}

export function cycleDuration(config: CycleConfig): number {
  const bars = config.preCountBars + audioSlotBars(config.audioDuration, config.bpm, config.beatsPerMeasure) + config.countOutBars;
  return bars * barDuration(config.bpm, config.beatsPerMeasure);
}

// Given elapsed time since the current cycle started, returns which phase
// we're in and the beat/bar position within that phase.
export function phaseAt(tInCycle: number, config: CycleConfig): PhasePosition {
  const beatSec = beatDuration(config.bpm);
  const barSec = barDuration(config.bpm, config.beatsPerMeasure);
  const audioBars = audioSlotBars(config.audioDuration, config.bpm, config.beatsPerMeasure);
  const totalBeatIndex = Math.floor(tInCycle / beatSec);
  const beatIndex = ((totalBeatIndex % config.beatsPerMeasure) + config.beatsPerMeasure) % config.beatsPerMeasure;
  const globalBar = Math.floor(tInCycle / barSec);

  if (globalBar < config.preCountBars) {
    return { phase: 'preCount', beatIndex, isAccent: beatIndex === 0, barInPhase: globalBar + 1, barsInPhase: config.preCountBars };
  }
  if (globalBar < config.preCountBars + audioBars) {
    return {
      phase: 'audio',
      beatIndex,
      isAccent: beatIndex === 0,
      barInPhase: globalBar - config.preCountBars + 1,
      barsInPhase: audioBars,
    };
  }
  return {
    phase: 'countOut',
    beatIndex,
    isAccent: beatIndex === 0,
    barInPhase: globalBar - config.preCountBars - audioBars + 1,
    barsInPhase: config.countOutBars,
  };
}

// Seconds from cycle start until the trimmed audio should start playing.
export function audioStartOffset(config: CycleConfig): number {
  return config.preCountBars * barDuration(config.bpm, config.beatsPerMeasure);
}

export interface SeekTarget {
  offsetInAudio: number;
  tInCycle: number;
  nextBeatIndex: number;
}

// Jumping to `offsetInAudio` seconds into the trimmed audio: where that lands
// in the cycle, and the first click on the existing beat grid at or after it
// (so the metronome stays locked to the cycle instead of restarting the bar).
export function seekTarget(offsetInAudio: number, config: CycleConfig): SeekTarget {
  const offset = Math.min(Math.max(0, offsetInAudio), config.audioDuration);
  const tInCycle = audioStartOffset(config) + offset;
  // Tolerance so float noise right on a beat never skips that beat's click.
  const nextBeatIndex = Math.ceil(tInCycle / beatDuration(config.bpm) - 1e-9);
  return { offsetInAudio: offset, tInCycle, nextBeatIndex };
}
