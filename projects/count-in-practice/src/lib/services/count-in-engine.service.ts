import { Injectable, signal } from '@angular/core';
import { CountInSettings, TrimRange, TransportState } from '../models';
import { CycleConfig, Phase, audioStartOffset, cycleDuration, phaseAt } from '../scheduling';

// Shared Web Audio lookahead-scheduler clock (classic Chris Wilson pattern), same
// technique as the-chords' own navbar metronome, extended to also trigger the
// trimmed audio buffer at the right point in each cycle. The click grid runs
// continuously across Pre-Count -> Audio -> Count-Out -> loop; phases are purely
// a label derived from position-in-cycle, never a separate scheduling mode.
@Injectable({ providedIn: 'root' })
export class CountInEngineService {
  readonly transport = signal<TransportState>('idle');
  readonly phase = signal<Phase>('preCount');
  readonly beatIndex = signal(0);
  readonly isAccent = signal(false);
  readonly barInPhase = signal(1);
  readonly barsInPhase = signal(1);

  private audioCtx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private trim: TrimRange = { start: 0, end: 0 };
  private settings: CountInSettings = { bpm: 100, beatsPerMeasure: 4, preCountBars: 1, countOutBars: 1 };

  private schedulerId: number | null = null;
  private readonly lookaheadMs = 25;
  private readonly scheduleAheadTime = 0.1;

  // "Cycle" = one full Pre-Count -> Audio -> Count-Out lap. cycleStartTime is the
  // audioCtx time the current lap began; it only changes on Stop or on looping.
  private cycleStartTime = 0;
  private nextClickBeatIndexInCycle = 0;
  private nextClickTime = 0;
  private scheduledAudioForCycleStart: number | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  // Clicks already handed to the audio thread (up to scheduleAheadTime ahead);
  // Stop must cancel them or they still sound after the transport is idle.
  private readonly scheduledClicks = new Set<OscillatorNode>();
  private readonly visualTimeouts = new Set<ReturnType<typeof setTimeout>>();

  get audioContext(): AudioContext {
    this.audioCtx ??= new AudioContext();
    return this.audioCtx;
  }

  setBuffer(buffer: AudioBuffer | null): void {
    this.buffer = buffer;
  }

  setTrim(trim: TrimRange): void {
    this.trim = trim;
  }

  setSettings(settings: CountInSettings): void {
    this.settings = settings;
  }

  private get config(): CycleConfig {
    const audioDuration = this.buffer ? Math.max(0, this.trim.end - this.trim.start) : 0;
    return {
      bpm: this.settings.bpm,
      beatsPerMeasure: this.settings.beatsPerMeasure,
      preCountBars: this.settings.preCountBars,
      countOutBars: this.settings.countOutBars,
      audioDuration,
    };
  }

  start(): void {
    if (!this.buffer) return;
    const ctx = this.audioContext;
    if (this.transport() === 'paused') {
      // audioCtx.resume() continues every already-scheduled time (clicks, the
      // buffer source) exactly where suspend() froze it — no repositioning needed.
      ctx.resume();
      this.transport.set('playing');
      this.schedulerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
      return;
    }
    if (ctx.state === 'suspended') ctx.resume();
    this.cycleStartTime = ctx.currentTime;
    this.nextClickBeatIndexInCycle = 0;
    this.nextClickTime = this.cycleStartTime;
    this.scheduledAudioForCycleStart = null;
    this.transport.set('playing');
    this.schedulerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  pause(): void {
    if (this.transport() !== 'playing') return;
    this.transport.set('paused');
    this.clearScheduler();
    this.audioContext.suspend();
  }

  stop(): void {
    this.transport.set('idle');
    this.clearScheduler();
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already finished naturally — nothing to stop.
      }
      this.currentSource = null;
    }
    for (const osc of this.scheduledClicks) osc.stop();
    this.scheduledClicks.clear();
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
    this.phase.set('preCount');
    this.beatIndex.set(0);
    this.isAccent.set(false);
    this.barInPhase.set(1);
    this.barsInPhase.set(this.settings.preCountBars);
  }

  private clearScheduler(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    for (const id of this.visualTimeouts) clearTimeout(id);
    this.visualTimeouts.clear();
  }

  private scheduler(): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    const config = this.config;
    const beatSec = 60 / config.bpm;
    const cycleSec = cycleDuration(config);
    if (cycleSec <= 0) return;

    while (this.nextClickTime < ctx.currentTime + this.scheduleAheadTime) {
      const tInCycle = this.nextClickBeatIndexInCycle * beatSec;
      if (tInCycle >= cycleSec) {
        this.cycleStartTime += cycleSec;
        this.nextClickBeatIndexInCycle = 0;
        this.scheduledAudioForCycleStart = null;
        continue;
      }
      const clickTime = this.cycleStartTime + tInCycle;
      const pos = phaseAt(tInCycle, config);
      this.playClick(clickTime, pos.isAccent);
      this.scheduleVisualUpdate(clickTime, pos);
      this.nextClickBeatIndexInCycle++;
      this.nextClickTime = this.cycleStartTime + this.nextClickBeatIndexInCycle * beatSec;
    }

    const audioAt = this.cycleStartTime + audioStartOffset(config);
    if (this.scheduledAudioForCycleStart !== this.cycleStartTime && audioAt < ctx.currentTime + this.scheduleAheadTime) {
      this.scheduledAudioForCycleStart = this.cycleStartTime;
      this.playAudio(audioAt);
    }
  }

  private playClick(time: number, isAccent: boolean): void {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isAccent ? 1400 : 900;
    gain.gain.setValueAtTime(isAccent ? 0.9 : 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
    this.scheduledClicks.add(osc);
    osc.onended = () => this.scheduledClicks.delete(osc);
  }

  private playAudio(time: number): void {
    if (!this.buffer) return;
    const duration = Math.max(0, this.trim.end - this.trim.start);
    if (duration <= 0) return;
    const ctx = this.audioContext;
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(ctx.destination);
    source.start(time, this.trim.start, duration);
    this.currentSource = source;
  }

  private scheduleVisualUpdate(time: number, pos: ReturnType<typeof phaseAt>): void {
    const delayMs = Math.max(0, (time - this.audioContext.currentTime) * 1000);
    const id = setTimeout(() => {
      this.visualTimeouts.delete(id);
      this.phase.set(pos.phase);
      this.beatIndex.set(pos.beatIndex);
      this.isAccent.set(pos.isAccent);
      this.barInPhase.set(pos.barInPhase);
      this.barsInPhase.set(pos.barsInPhase);
    }, delayMs);
    this.visualTimeouts.add(id);
  }
}
