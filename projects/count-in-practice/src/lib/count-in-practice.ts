import { Component, computed, effect, inject, input, signal } from '@angular/core';
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
  CountInSettings,
  Language,
  SILENCE_DB_MAX,
  SILENCE_DB_MIN,
  TIME_SIGNATURES,
  Theme,
  TrimRange,
  YOUTUBE_LEAD_MS_MAX,
  YOUTUBE_LEAD_MS_MIN,
} from './models';
import { CountInEngineService } from './services/count-in-engine.service';
import { SettingsStorageService } from './services/settings-storage.service';
import { SilenceTrimMode } from './silence';
import { createTapTempoState, registerTap } from './tap-tempo';
import { parseYouTubeId } from './youtube';

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
export class CountInPractice {
  private readonly settingsStorage = inject(SettingsStorageService);
  readonly engine = inject(CountInEngineService);

  readonly language = input<Language>('en');
  readonly theme = input<Theme>('dark');
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

  private readonly stored = this.settingsStorage.load();
  readonly bpm = signal(this.stored.bpm);
  // Raw field value, kept apart from `bpm` so a half-typed number ("1" on the
  // way to "120") isn't clamped mid-edit; null while the field is empty.
  readonly bpmInputValue = signal<number | null>(this.stored.bpm);
  readonly beatsPerMeasure = signal(this.stored.beatsPerMeasure);
  readonly preCountBars = signal(this.stored.preCountBars);
  readonly countOutBars = signal(this.stored.countOutBars);
  readonly silenceThresholdDb = signal(this.stored.silenceThresholdDb);
  readonly silenceMode = signal<SilenceTrimMode>('both');
  readonly youtubeLeadMs = signal(this.stored.youtubeLeadMs);

  readonly source = signal<AudioSource>('file');
  readonly youtubeUrl = signal('');
  readonly youtubeVideoId = signal<string | null>(null);
  readonly youtubeDuration = signal<number | null>(null); // null until the player is ready
  readonly youtubeRange = signal<TrimRange>({ start: 0, end: 0 });
  readonly youtubeError = signal<string | null>(null);
  private youtubePlayer: YoutubePlayer | null = null;

  readonly audioFile = signal<File | null>(null);
  readonly audioBuffer = signal<AudioBuffer | null>(null);
  readonly hasAudio = computed(() =>
    this.source() === 'youtube'
      ? this.youtubeDuration() !== null && this.youtubeRange().end > this.youtubeRange().start
      : this.audioBuffer() !== null,
  );
  readonly trimRange = signal<TrimRange>({ start: 0, end: 0 });
  readonly errorMessage = signal<string | null>(null);

  readonly detectingBpm = signal(false);
  readonly isDraggingFile = signal(false);
  readonly canUndoCrop = signal(false);
  readonly canUndoSilence = signal(false);
  readonly silenceMessage = signal<string | null>(null);
  private tapState = createTapTempoState();
  private dragCounter = 0;

  readonly beatDots = computed(() => Array.from({ length: this.beatsPerMeasure() }, (_, i) => i));
  readonly playPauseLabel = computed(() => (this.engine.transport() === 'playing' ? this.text().pause : this.text().play));
  readonly phaseLabel = computed(() => {
    const phase = this.engine.phase();
    const text = this.text();
    return phase === 'preCount' ? text.phasePreCount : phase === 'audio' ? text.phaseAudio : text.phaseCountOut;
  });

  constructor() {
    effect(() => {
      const settings: CountInSettings = {
        bpm: this.bpm(),
        beatsPerMeasure: this.beatsPerMeasure(),
        preCountBars: this.preCountBars(),
        countOutBars: this.countOutBars(),
      };
      this.engine.setSettings(settings);
      this.engine.setExternalLead(this.youtubeLeadMs() / 1000);
      this.settingsStorage.save({ ...settings, silenceThresholdDb: this.silenceThresholdDb(), youtubeLeadMs: this.youtubeLeadMs() });
    });
  }

  // Leaving a source unmounts its view; the file's trimmer re-decodes and
  // re-emits loaded/trimChange when it comes back, the YouTube player re-emits ready.
  setSource(source: AudioSource): void {
    this.engine.stop();
    this.engine.setBuffer(null);
    this.engine.setExternal(null);
    this.audioBuffer.set(null);
    this.youtubeDuration.set(null);
    this.youtubePlayer = null;
    this.errorMessage.set(null);
    this.source.set(source);
  }

  loadYoutube(): void {
    const id = parseYouTubeId(this.youtubeUrl());
    this.youtubeError.set(id ? null : this.text().youtubeUrlError);
    if (!id || id === this.youtubeVideoId()) return;
    this.engine.stop();
    this.engine.setExternal(null);
    this.youtubePlayer = null;
    this.youtubeDuration.set(null);
    this.youtubeRange.set({ start: 0, end: 0 });
    this.youtubeVideoId.set(id);
  }

  onYoutubeReady(player: YoutubePlayer, duration: number): void {
    this.youtubePlayer = player;
    this.youtubeDuration.set(duration);
    // Keep the range when the same video remounts (switching sources and back).
    if (this.youtubeRange().end === 0) this.youtubeRange.set({ start: 0, end: duration });
    this.engine.setExternal(player);
    this.engine.setTrim(this.youtubeRange());
  }

  onYoutubeError(): void {
    this.youtubeDuration.set(null);
    this.youtubeError.set(this.text().youtubeLoadError);
  }

  // ngModel on type="number" emits null while the field is empty or mid-edit.
  onYoutubeRangeInput(edge: keyof TrimRange, value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.setYoutubeEdge(edge, value);
  }

  useYoutubeTime(edge: keyof TrimRange): void {
    if (this.youtubePlayer) this.setYoutubeEdge(edge, this.youtubePlayer.currentTime());
  }

  // Seconds rounded to centiseconds; YouTube reports 0 for durations it doesn't know yet.
  private setYoutubeEdge(edge: keyof TrimRange, value: number): void {
    const max = this.youtubeDuration() || Infinity;
    const range = { ...this.youtubeRange(), [edge]: Math.round(Math.min(max, Math.max(0, value)) * 100) / 100 };
    this.youtubeRange.set(range);
    this.engine.setTrim(range);
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
    if (this.source() !== 'file') this.setSource('file');
    this.engine.stop();
    this.audioBuffer.set(null);
    this.errorMessage.set(null);
    this.audioFile.set(file);
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
