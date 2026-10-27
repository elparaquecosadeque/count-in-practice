import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  afterRenderEffect,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import ZoomPlugin from 'wavesurfer.js/plugins/zoom';
import { cropAudioBuffer } from '../../audio-crop';
import { SilenceTrimMode, findSoundBounds } from '../../silence';
import { encodeWav } from '../../wav-encoder';
import { Theme, TrimRange } from '../../models';

export interface WaveformLoaded {
  buffer: AudioBuffer;
  duration: number;
}

export interface AudioState {
  blob: Blob;
  buffer: AudioBuffer;
}

// Everything about one loaded file that must survive the trimmer being
// unmounted (leaving the page): the decoded audio, the crop undo snapshot and
// the trim/silence ranges. Owned by the caller; the trimmer reads and writes it.
export interface WaveformSession {
  file: File;
  current: AudioState | null;
  previous: AudioState | null;
  range: TrimRange | null;
  rangeBeforeSilence: TrimRange | null;
}

// Thin wrapper around wavesurfer.js (core) + its official RegionsPlugin — not the
// stale, NgModule-based `angular-wavesurfer-service` package. Renders the real
// waveform and a single draggable/resizable region that defines the trim range,
// which can also be applied destructively (crop to selection, with one undo).
@Component({
  selector: 'the-chords-waveform-trimmer',
  imports: [],
  templateUrl: './waveform-trimmer.html',
  styleUrl: './waveform-trimmer.scss',
  // `::part()` targets elements wavesurfer.js renders inside its own shadow
  // root — they never get Angular's `_ngcontent` scoping attribute, so
  // emulated encapsulation's rewritten selectors can never match them.
  encapsulation: ViewEncapsulation.None,
})
export class WaveformTrimmer implements AfterViewInit, OnDestroy {
  readonly session = input<WaveformSession | null>(null);
  // While the engine is playing, trim/crop edits would change the cycle length
  // mid-loop — the parent locks the regions instead.
  readonly locked = input(false);
  // Playback position from the engine (seconds into the buffer) — the engine,
  // not wavesurfer, does the playing, so wavesurfer's own cursor never moves.
  readonly cursorTime = input(0);
  // Only a trigger: wavesurfer paints on a canvas with colors read once from
  // the theme tokens, so they have to be re-read when the theme flips.
  readonly theme = input<Theme>('dark');

  readonly loaded = output<WaveformLoaded>();
  readonly trimChange = output<TrimRange>();
  readonly loadError = output<void>();
  readonly canUndo = output<boolean>();
  readonly canUndoSilence = output<boolean>();
  // User clicked/dragged on the waveform to this time (seconds into the buffer).
  readonly seek = output<number>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');

  private wavesurfer: WaveSurfer | null = null;
  private regions: ReturnType<typeof RegionsPlugin.create> | null = null;
  private activeRegion: Region | null = null;
  private viewReady = false;
  private removeCtrlWheelGuard: (() => void) | null = null;

  constructor() {
    // Signal inputs don't fire ngOnChanges — react via effect(), guarded until
    // the view (and its viewChild container) actually exists.
    effect(() => {
      this.session();
      if (this.viewReady) this.loadSession();
    });
    effect(() => {
      const editable = !this.locked();
      this.activeRegion?.setOptions({ drag: editable, resize: editable });
    });
    // After render, so the parent's data-theme (and its tokens) is applied
    // before the colors are read.
    afterRenderEffect(() => {
      this.theme();
      if (!this.wavesurfer) return;
      const { waveColor, progressColor, cursorColor, regionColor } = this.readColors();
      this.wavesurfer.setOptions({ waveColor, progressColor, cursorColor });
      this.activeRegion?.setOptions({ color: regionColor });
    });
    effect(() => {
      const time = this.cursorTime();
      if (this.activeRegion) this.wavesurfer?.setTime(time); // activeRegion set = waveform ready
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadSession();
  }

  ngOnDestroy(): void {
    this.wavesurfer?.destroy();
    this.removeCtrlWheelGuard?.();
  }

  // Destructive: keeps only the trim selection and reloads the waveform with
  // it. Keeps the pre-crop state so undo() can restore it — one level only.
  async cropToSelection(): Promise<void> {
    const session = this.session();
    if (!this.activeRegion || !session?.current) return;
    const cropped = cropAudioBuffer(session.current.buffer, this.activeRegion.start, this.activeRegion.end);
    const blob = new Blob([encodeWav(cropped)], { type: 'audio/wav' });

    session.previous = session.current;
    this.canUndo.emit(true);
    await this.mountWavesurfer(session, { blob, buffer: cropped });
  }

  // Non-destructive: moves the trim region's edge(s) in to the first/last
  // sound above `thresholdDb` inside the current selection. Returns false
  // (and changes nothing) if the whole selection is below the threshold.
  trimSilence(thresholdDb: number, mode: SilenceTrimMode): boolean {
    const region = this.activeRegion;
    const session = this.session();
    if (!region || !session?.current) return false;
    const { buffer } = session.current;
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    const bounds = findSoundBounds(channels, buffer.sampleRate, region.start, region.end, thresholdDb);
    if (!bounds) return false;
    session.rangeBeforeSilence = { start: region.start, end: region.end };
    this.canUndoSilence.emit(true);
    region.setOptions({
      start: mode === 'end' ? region.start : bounds.start,
      end: mode === 'start' ? region.end : bounds.end,
    });
    this.emitTrim();
    return true;
  }

  undoSilence(): void {
    const session = this.session();
    const range = session?.rangeBeforeSilence;
    if (!session || !range || !this.activeRegion) return;
    this.activeRegion.setOptions(range);
    this.emitTrim();
    session.rangeBeforeSilence = null;
    this.canUndoSilence.emit(false);
  }

  async undo(): Promise<void> {
    const session = this.session();
    if (!session?.previous) return;
    const state = session.previous;
    session.previous = null;
    this.canUndo.emit(false);
    await this.mountWavesurfer(session, state);
  }

  private async loadSession(): Promise<void> {
    const session = this.session();
    if (!session) {
      this.teardown();
      this.canUndo.emit(false);
      return;
    }
    // Coming back to a file already decoded: restore it as it was left.
    if (session.current) {
      this.canUndo.emit(session.previous !== null);
      await this.mountWavesurfer(session, session.current, true);
      return;
    }
    const { file } = session;

    // Decode ourselves rather than letting wavesurfer fetch+decode the blob
    // internally: we need the AudioBuffer for the playback engine anyway, and
    // handing wavesurfer the already-decoded channel data + duration lets it
    // render immediately instead of waiting on its own fetch/decode pipeline.
    let buffer: AudioBuffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodeCtx = new AudioContext();
      try {
        buffer = await decodeCtx.decodeAudioData(arrayBuffer);
      } finally {
        decodeCtx.close();
      }
    } catch {
      this.loadError.emit();
      return;
    }
    if (this.session() !== session) return; // superseded by a newer file while decoding

    this.canUndo.emit(false);
    await this.mountWavesurfer(session, { blob: file, buffer });
  }

  // Tears down the wavesurfer instance itself; the session (and its undo
  // snapshot) is the caller's and outlives it.
  private teardown(): void {
    this.wavesurfer?.destroy();
    this.wavesurfer = null;
    this.regions = null;
    this.activeRegion = null;
    this.removeCtrlWheelGuard?.();
    this.removeCtrlWheelGuard = null;
  }

  private readColors() {
    const style = getComputedStyle(this.container().nativeElement);
    const waveColor = style.getPropertyValue('--mat-sys-outline').trim() || '#888';
    const progressColor = style.getPropertyValue('--mat-sys-primary').trim() || '#3b82f6';
    const cursorColor = style.getPropertyValue('--mat-sys-tertiary').trim() || '#f59e0b';
    const regionColor = `color-mix(in srgb, ${progressColor} 25%, transparent)`;
    return { waveColor, progressColor, cursorColor, regionColor };
  }

  // `restore`: remounting the session's own current audio, so its range and
  // silence undo still apply. Otherwise a new or changed buffer gets a fresh
  // full-length region; the old ranges mean nothing.
  private async mountWavesurfer(session: WaveformSession, state: AudioState, restore = false): Promise<void> {
    this.teardown();
    session.current = state;
    if (!restore) {
      session.range = null;
      session.rangeBeforeSilence = null;
    }
    this.canUndoSilence.emit(session.rangeBeforeSilence !== null);
    const { blob, buffer } = state;

    const host = this.container().nativeElement;
    const { waveColor, progressColor, cursorColor, regionColor } = this.readColors();

    const channelData: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) channelData.push(buffer.getChannelData(c));

    const regions = RegionsPlugin.create();
    this.regions = regions;

    const wavesurfer = WaveSurfer.create({
      container: host,
      height: 96,
      waveColor,
      progressColor,
      cursorColor,
      barWidth: 2,
      barGap: 1,
      plugins: [
        regions,
        // The plugin derives its label font size from height (height / 2), so
        // 24 -> 12px labels; secondary labels default to 25% opacity, too faint.
        // No color: labels inherit the host's on-surface, so they follow the theme.
        TimelinePlugin.create({ height: 24, secondaryLabelOpacity: 0.6, style: { opacity: '0.8' } }),
        // Linear zoom (the default) adds deltaY * scale px/sec per wheel tick,
        // ~+50px/s — on a 3-minute file that's ~19x zoom from a single tick.
        // Exponential multiplies by a fixed factor per tick instead, so it
        // feels the same on any length: `iterations` = ticks from fully zoomed
        // out to maxZoom (more = gentler).
        ZoomPlugin.create({ exponentialZooming: true, iterations: 30 }),
      ],
    });
    this.wavesurfer = wavesurfer;

    // The Zoom plugin zooms on ANY vertical wheel scroll, Ctrl held or not —
    // it never needs Ctrl. Ctrl+wheel is a shortcut the OS/browser already
    // owns (page zoom, a magnifier, whatever) outside of our control; trying
    // to preventDefault it just fights that other zoom instead of avoiding
    // it. Simplest fix: never let Ctrl+wheel reach the plugin at all — plain
    // scroll still zooms the waveform, Ctrl+scroll passes through untouched,
    // identical to scrolling over blank page.
    const ctrlWheelBypass = (event: WheelEvent) => {
      if (event.ctrlKey) event.stopPropagation();
    };
    host.addEventListener('wheel', ctrlWheelBypass, { capture: true });
    this.removeCtrlWheelGuard = () => host.removeEventListener('wheel', ctrlWheelBypass, { capture: true });

    wavesurfer.on('error', () => this.loadError.emit());
    wavesurfer.on('interaction', (time) => this.seek.emit(time));

    wavesurfer.on('ready', (duration) => {
      const region = regions.addRegion({
        start: session.range?.start ?? 0,
        end: session.range?.end ?? duration,
        drag: !this.locked(),
        resize: !this.locked(),
        color: regionColor,
      });
      this.activeRegion = region;
      region.on('update-end', () => this.emitTrim());

      this.loaded.emit({ buffer, duration });
      this.emitTrim();
    });

    wavesurfer.loadBlob(blob, channelData, buffer.duration);
  }

  private emitTrim(): void {
    const region = this.activeRegion;
    const session = this.session();
    if (!region || !session) return;
    session.range = { start: region.start, end: region.end };
    this.trimChange.emit(session.range);
  }
}
