import { Component, ElementRef, OnDestroy, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { detectBpm as detectBpmFromBuffer } from './bpm-detector';
import { WaveformLoaded, WaveformTrimmer } from './components/waveform-trimmer/waveform-trimmer';
import { YoutubePlayer } from './components/youtube-player/youtube-player';
import {
  AudioSource,
  BARS_MAX,
  BARS_MIN,
  BPM_MAX,
  BPM_MIN,
  BeatAccent,
  Language,
  SILENCE_DB_MAX,
  SILENCE_DB_MIN,
  TIME_SIGNATURES,
  Theme,
  TrimRange,
  defaultAccents,
  YOUTUBE_LEAD_MS_MAX,
  YOUTUBE_LEAD_MS_MIN,
} from './models';
import { CountInEngineService } from './services/count-in-engine.service';
import { CountInStore } from './services/count-in-store.service';
import { createTapTempoState, registerTap } from './tap-tempo';

export interface CountInPracticeCopy {
  title: string;
  subtitle: string;
  uploadLabel: string;
  uploadHint: string;
  dropHint: string;
  dropActiveHint: string;
  replaceAudioLabel: string;
  dropReplaceHint: string;
  bpmLabel: string;
  detectBpmLabel: string;
  detectingBpm: string;
  detectBpmError: string;
  tapTempoLabel: string;
  timeSignatureLabel: string;
  preCountLabel: string;
  countOutLabel: string;
  barsUnit: string;
  sourceFile: string;
  sourceYoutube: string;
  youtubeUrlLabel: string;
  loadVideoLabel: string;
  youtubeUrlError: string;
  youtubeLoadError: string;
  useCurrentTime: string;
  youtubeLeadLabel: string;
  youtubeLeadHint: string;
  start: string;
  end: string;
  cropLabel: string;
  undoCropLabel: string;
  trimSilenceLabel: string;
  undoSilenceLabel: string;
  silenceThresholdLabel: string;
  silenceModeLabel: string;
  silenceModeBoth: string;
  silenceModeStart: string;
  silenceModeEnd: string;
  noSoundFound: string;
  play: string;
  pause: string;
  stop: string;
  spaceKey: string;
  phasePreCount: string;
  phaseAudio: string;
  phaseCountOut: string;
  bar: string;
  beat: string;
  of: string;
  accentStrong: string;
  accentNormal: string;
  accentMute: string;
  accentHint: string;
  decodeError: string;
}

const COPY: Record<Language, CountInPracticeCopy> = {
  en: {
    title: 'Count-In Practice',
    subtitle: 'Upload a clip, trim it, and loop it behind a metronome count-in and count-out.',
    uploadLabel: 'Upload audio',
    uploadHint: 'MP3, WAV or M4A',
    dropHint: 'or drag and drop a file here',
    dropActiveHint: 'Drop to upload',
    replaceAudioLabel: 'Replace audio',
    dropReplaceHint: 'Drop to replace the audio',
    bpmLabel: 'BPM',
    detectBpmLabel: 'Detect BPM',
    detectingBpm: 'Detecting…',
    detectBpmError: "Couldn't detect a tempo — try tap tempo instead.",
    tapTempoLabel: 'Tap',
    timeSignatureLabel: 'Time signature',
    preCountLabel: 'Pre-count',
    countOutLabel: 'Count-out',
    barsUnit: 'bars',
    sourceFile: 'File',
    sourceYoutube: 'YouTube',
    youtubeUrlLabel: 'YouTube link',
    loadVideoLabel: 'Load',
    youtubeUrlError: "That doesn't look like a YouTube link.",
    youtubeLoadError: "That video can't be played here — it may be private, removed, or have embedding turned off.",
    useCurrentTime: "Use the video's current time",
    youtubeLeadLabel: 'Video lead (ms)',
    youtubeLeadHint: "The video is started this early to make up for YouTube's delay. Raise it if the video comes in late after the count-in.",
    start: 'Start',
    end: 'End',
    cropLabel: 'Crop to selection',
    undoCropLabel: 'Undo crop',
    trimSilenceLabel: 'Trim silence',
    undoSilenceLabel: 'Undo silence trim',
    silenceThresholdLabel: 'Threshold (dB)',
    silenceModeLabel: 'Where',
    silenceModeBoth: 'Start and end',
    silenceModeStart: 'Start only',
    silenceModeEnd: 'End only',
    noSoundFound: 'Nothing in the selection is louder than the threshold — try a lower dB value.',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    spaceKey: 'Space',
    phasePreCount: 'Pre-Count',
    phaseAudio: 'Audio',
    phaseCountOut: 'Count-Out',
    bar: 'Bar',
    beat: 'Beat',
    of: 'of',
    accentStrong: 'strong',
    accentNormal: 'normal',
    accentMute: 'silent',
    accentHint: 'Click to cycle: strong → normal → silent',
    decodeError: "That file couldn't be decoded — try a different MP3, WAV or M4A.",
  },
  es: {
    title: 'Práctica de Count-In',
    subtitle: 'Sube un fragmento, recórtalo, y ponlo en loop con un count-in y count-out de metrónomo.',
    uploadLabel: 'Subir audio',
    uploadHint: 'MP3, WAV o M4A',
    dropHint: 'o arrastra y suelta un archivo aquí',
    dropActiveHint: 'Suelta para subir',
    replaceAudioLabel: 'Reemplazar audio',
    dropReplaceHint: 'Suelta para reemplazar el audio',
    bpmLabel: 'BPM',
    detectBpmLabel: 'Detectar BPM',
    detectingBpm: 'Detectando…',
    detectBpmError: 'No se pudo detectar un tempo — prueba con tap tempo.',
    tapTempoLabel: 'Tap',
    timeSignatureLabel: 'Compás',
    preCountLabel: 'Pre-count',
    countOutLabel: 'Count-out',
    barsUnit: 'compases',
    sourceFile: 'Archivo',
    sourceYoutube: 'YouTube',
    youtubeUrlLabel: 'Link de YouTube',
    loadVideoLabel: 'Cargar',
    youtubeUrlError: 'Ese link no parece de YouTube.',
    youtubeLoadError: 'Ese video no se puede reproducir aquí — puede ser privado, haber sido eliminado o tener desactivada la inserción.',
    useCurrentTime: 'Usar el tiempo actual del video',
    youtubeLeadLabel: 'Adelanto (ms)',
    youtubeLeadHint: 'El video arranca con este adelanto para compensar la demora de YouTube. Súbelo si el video entra tarde después del count-in.',
    start: 'Inicio',
    end: 'Fin',
    cropLabel: 'Recortar a la selección',
    undoCropLabel: 'Deshacer recorte',
    trimSilenceLabel: 'Quitar silencios',
    undoSilenceLabel: 'Deshacer quitar silencios',
    silenceThresholdLabel: 'Umbral (dB)',
    silenceModeLabel: 'Dónde',
    silenceModeBoth: 'Inicio y final',
    silenceModeStart: 'Solo inicio',
    silenceModeEnd: 'Solo final',
    noSoundFound: 'Nada en la selección supera el umbral — prueba con un valor de dB más bajo.',
    play: 'Reproducir',
    pause: 'Pausar',
    stop: 'Detener',
    spaceKey: 'Espacio',
    phasePreCount: 'Pre-Count',
    phaseAudio: 'Audio',
    phaseCountOut: 'Count-Out',
    bar: 'Compás',
    beat: 'Tiempo',
    of: 'de',
    accentStrong: 'fuerte',
    accentNormal: 'normal',
    accentMute: 'silencio',
    accentHint: 'Clic para cambiar: fuerte → normal → silencio',
    decodeError: 'No se pudo decodificar ese archivo — prueba con otro MP3, WAV o M4A.',
  },
};

@Component({
  selector: 'the-chords-count-in-practice',
  imports: [
    FormsModule,
    WaveformTrimmer,
    YoutubePlayer,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './count-in-practice.html',
  styleUrl: './count-in-practice.scss',
  host: {
    '[attr.lang]': 'language()',
    '[attr.data-theme]': 'theme()',
    '(document:keydown.space)': 'onSpaceKey($event)',
  },
})
export class CountInPractice implements OnDestroy {
  readonly engine = inject(CountInEngineService);
  readonly store = inject(CountInStore);

  readonly language = input<Language>('en');
  readonly theme = input<Theme>('dark');
  // False when the host page shows its own title above this component.
  readonly showHeader = input(true);
  readonly text = computed(() => COPY[this.language()]);

  readonly timeSignatures = TIME_SIGNATURES;
  readonly bpmMin = BPM_MIN;
  readonly bpmMax = BPM_MAX;
  readonly barsMin = BARS_MIN;
  readonly barsMax = BARS_MAX;
  readonly silenceDbMin = SILENCE_DB_MIN;
  readonly silenceDbMax = SILENCE_DB_MAX;
  readonly youtubeLeadMsMin = YOUTUBE_LEAD_MS_MIN;
  readonly youtubeLeadMsMax = YOUTUBE_LEAD_MS_MAX;
  readonly youtubeEdges = ['start', 'end'] as const;

  // State lives in the root store so it outlives this view (see CountInStore).
  readonly bpm = this.store.bpm;
  // Raw field value, kept apart from `bpm` so a half-typed number ("1" on the
  // way to "120") isn't clamped mid-edit; null while the field is empty. Follows
  // `bpm` whenever that changes, also from outside (a host's metronome).
  readonly bpmInputValue = linkedSignal<number | null>(() => this.bpm());
  readonly beatsPerMeasure = this.store.beatsPerMeasure;
  readonly accents = this.store.accents;
  readonly preCountBars = this.store.preCountBars;
  readonly countOutBars = this.store.countOutBars;
  readonly silenceThresholdDb = this.store.silenceThresholdDb;
  readonly silenceMode = this.store.silenceMode;
  readonly youtubeLeadMs = this.store.youtubeLeadMs;

  readonly source = this.store.source;
  readonly youtubeUrl = this.store.youtubeUrl;
  readonly youtubeVideoId = this.store.youtubeVideoId;
  readonly youtubeDuration = this.store.youtubeDuration;
  readonly youtubeRange = this.store.youtubeRange;
  readonly youtubeError = this.store.youtubeError;

  readonly audioFile = this.store.audioFile;
  readonly audioBuffer = this.store.audioBuffer;
  readonly hasAudio = computed(() =>
    this.source() === 'youtube'
      ? this.youtubeDuration() !== null && this.youtubeRange().end > this.youtubeRange().start
      : this.audioBuffer() !== null,
  );
  readonly trimRange = this.store.trimRange;
  readonly canUndoCrop = this.store.canUndoCrop;
  readonly canUndoSilence = this.store.canUndoSilence;
  readonly errorMessage = signal<string | null>(null);

  readonly detectingBpm = signal(false);
  readonly isDraggingFile = signal(false);
  readonly silenceMessage = signal<string | null>(null);
  private tapState = createTapTempoState();
  private dragCounter = 0;

  // With a CountInYoutubeHost in the app shell, the player lives there and is
  // placed over this empty slot, so it survives leaving the page.
  private readonly youtubeSlot = viewChild<ElementRef<HTMLElement>>('youtubeSlot');

  readonly playPauseLabel = computed(() => (this.engine.transport() === 'playing' ? this.text().pause : this.text().play));
  readonly phaseLabel = computed(() => {
    const phase = this.engine.phase();
    const text = this.text();
    return phase === 'preCount' ? text.phasePreCount : phase === 'audio' ? text.phaseAudio : text.phaseCountOut;
  });

  constructor() {
    effect(() => this.store.youtubeSlot.set(this.youtubeSlot()?.nativeElement ?? null));
  }

  ngOnDestroy(): void {
    this.store.youtubeSlot.set(null);
    // An inline player goes away with this view; the loop can't keep driving it.
    if (this.source() === 'youtube' && !this.store.hostPresent()) this.engine.stop();
  }

  setSource(source: AudioSource): void {
    this.errorMessage.set(null);
    this.store.setSource(source);
  }

  loadYoutube(): void {
    if (!this.store.loadYoutube(this.youtubeUrl())) this.youtubeError.set(this.text().youtubeUrlError);
  }

  onYoutubeReady(player: YoutubePlayer, duration: number): void {
    this.store.onYoutubeReady(player, duration);
  }

  onYoutubeError(): void {
    this.store.onYoutubeError(this.text().youtubeLoadError);
  }

  // ngModel on type="number" emits null while the field is empty or mid-edit.
  onYoutubeRangeInput(edge: keyof TrimRange, value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.store.setYoutubeEdge(edge, value);
  }

  useYoutubeTime(edge: keyof TrimRange): void {
    const player = this.store.youtubePlayer;
    if (player) this.store.setYoutubeEdge(edge, player.currentTime());
  }

  onYoutubeLeadChange(value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.youtubeLeadMs.set(Math.min(YOUTUBE_LEAD_MS_MAX, Math.max(YOUTUBE_LEAD_MS_MIN, Math.round(value))));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.handleFile(file);
    input.value = ''; // allow re-selecting the same file to re-trigger change
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.types.includes('Files')) return;
    this.dragCounter++;
    this.isDraggingFile.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.isDraggingFile.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragCounter = 0;
    this.isDraggingFile.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    this.errorMessage.set(null);
    this.store.loadFile(file);
  }

  onWaveformLoaded(loaded: WaveformLoaded): void {
    this.engine.setBuffer(loaded.buffer);
    this.audioBuffer.set(loaded.buffer);
  }

  onWaveformError(): void {
    this.audioBuffer.set(null);
    this.engine.setBuffer(null);
    this.errorMessage.set(this.text().decodeError);
  }

  onTrimChange(range: TrimRange): void {
    this.trimRange.set(range);
    this.engine.setTrim(range);
  }

  // ngModel on type="number" emits a number, or null while the field is empty
  // or mid-edit — never a string.
  onBpmInput(value: number | null): void {
    this.bpmInputValue.set(value);
    if (value !== null && value >= BPM_MIN && value <= BPM_MAX) this.bpm.set(value);
  }

  // An empty field on blur keeps the current tempo instead of becoming 0 -> 40.
  onBpmBlur(): void {
    this.applyBpm(this.bpmInputValue() ?? this.bpm());
  }

  async detectBpm(): Promise<void> {
    const buffer = this.audioBuffer();
    if (!buffer || this.detectingBpm()) return;
    this.detectingBpm.set(true);
    this.errorMessage.set(null);
    try {
      const { start, end } = this.trimRange();
      const bpm = await detectBpmFromBuffer(buffer, start, end - start);
      this.applyBpm(bpm);
    } catch {
      this.errorMessage.set(this.text().detectBpmError);
    } finally {
      this.detectingBpm.set(false);
    }
  }

  onTap(): void {
    const { state, bpm } = registerTap(this.tapState, performance.now());
    this.tapState = state;
    if (bpm !== null) this.applyBpm(bpm);
  }

  private applyBpm(value: number): void {
    const clamped = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
    this.bpm.set(clamped);
    this.bpmInputValue.set(clamped);
  }

  onTimeSignatureChange(value: string): void {
    this.beatsPerMeasure.set(Number(value));
    this.accents.set(defaultAccents(Number(value)));
  }

  // Live, even while playing: the scheduler reads the pattern per click.
  cycleAccent(index: number): void {
    const next: Record<BeatAccent, BeatAccent> = { strong: 'normal', normal: 'mute', mute: 'strong' };
    this.accents.update((accents) => accents.map((accent, i) => (i === index ? next[accent] : accent)));
  }

  accentLabel(accent: BeatAccent): string {
    const text = this.text();
    return accent === 'strong' ? text.accentStrong : accent === 'normal' ? text.accentNormal : text.accentMute;
  }

  onPreCountChange(value: string): void {
    this.preCountBars.set(this.clampBars(value));
  }

  onCountOutChange(value: string): void {
    this.countOutBars.set(this.clampBars(value));
  }

  private clampBars(value: string): number {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return BARS_MIN;
    return Math.min(BARS_MAX, Math.max(BARS_MIN, Math.round(parsed)));
  }

  // Global Space = play/pause, except when focus is on something Space already
  // means something for (typing, a focused button's own click, mat-select).
  onSpaceKey(event: Event): void {
    const target = event.target as HTMLElement;
    if ((event as KeyboardEvent).repeat || !this.hasAudio()) return;
    if (target.closest('input, textarea, select, button, [contenteditable], [role="combobox"], [role="listbox"]')) return;
    event.preventDefault(); // otherwise the page scrolls
    this.togglePlayPause();
  }

  // ngModel on type="number" emits a number, or null while the field is empty
  // or mid-edit (e.g. just "-").
  onSilenceThresholdChange(value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.silenceThresholdDb.set(Math.min(SILENCE_DB_MAX, Math.max(SILENCE_DB_MIN, Math.round(value))));
  }

  trimSilence(trimmer: WaveformTrimmer): void {
    const found = trimmer.trimSilence(this.silenceThresholdDb(), this.silenceMode());
    this.silenceMessage.set(found ? null : this.text().noSoundFound);
  }

  togglePlayPause(): void {
    if (this.engine.transport() === 'playing') {
      this.engine.pause();
    } else {
      this.engine.start();
    }
  }

  stop(): void {
    this.engine.stop();
  }
}
