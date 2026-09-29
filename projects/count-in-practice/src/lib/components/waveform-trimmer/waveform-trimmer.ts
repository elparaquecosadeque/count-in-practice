import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation, effect, input, output, viewChild } from '@angular/core';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import ZoomPlugin from 'wavesurfer.js/plugins/zoom';
import { TrimRange } from '../../models';

export interface WaveformLoaded {
  buffer: AudioBuffer;
  duration: number;
}

// Thin wrapper around wavesurfer.js (core) + its official RegionsPlugin — not the
// stale, NgModule-based `angular-wavesurfer-service` package. Renders the real
// waveform and a single draggable/resizable region that defines the trim range.
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
  readonly file = input<File | null>(null);

  readonly loaded = output<WaveformLoaded>();
  readonly trimChange = output<TrimRange>();
  readonly loadError = output<void>();

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
      this.file();
      if (this.viewReady) this.loadCurrentFile();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadCurrentFile();
  }

  ngOnDestroy(): void {
    this.wavesurfer?.destroy();
    this.removeCtrlWheelGuard?.();
  }

  private async loadCurrentFile(): Promise<void> {
    const file = this.file();
    this.wavesurfer?.destroy();
    this.wavesurfer = null;
    this.regions = null;
    this.activeRegion = null;
    this.removeCtrlWheelGuard?.();
    this.removeCtrlWheelGuard = null;
    if (!file) return;

    const host = this.container().nativeElement;
    const style = getComputedStyle(host);
    const waveColor = style.getPropertyValue('--mat-sys-outline').trim() || '#888';
    const progressColor = style.getPropertyValue('--mat-sys-primary').trim() || '#3b82f6';
    const cursorColor = style.getPropertyValue('--mat-sys-tertiary').trim() || '#f59e0b';
    const timelineColor = style.getPropertyValue('--mat-sys-on-surface').trim() || '#f8f8ff';
    const regionColor = `color-mix(in srgb, ${progressColor} 25%, transparent)`;

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
    if (this.file() !== file) return; // superseded by a newer file while decoding

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
        TimelinePlugin.create({ height: 16, style: { color: timelineColor, opacity: '0.6' } }),
        ZoomPlugin.create({ scale: 0.5 }),
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

    wavesurfer.on('ready', (duration) => {
      const region = regions.addRegion({
        start: 0,
        end: duration,
        drag: true,
        resize: true,
        color: regionColor,
      });
      this.activeRegion = region;
      region.on('update-end', () => this.emitTrim());

      this.loaded.emit({ buffer, duration });
      this.trimChange.emit({ start: region.start, end: region.end });
    });

    wavesurfer.loadBlob(file, channelData, buffer.duration);
  }

  private emitTrim(): void {
    const region = this.activeRegion;
    if (!region) return;
    this.trimChange.emit({ start: region.start, end: region.end });
  }
}
