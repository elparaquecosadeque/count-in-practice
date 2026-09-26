import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WaveformLoaded, WaveformTrimmer } from './components/waveform-trimmer/waveform-trimmer';
import { CountInSettings, Language, TrimRange } from './models';
import { CountInEngineService } from './services/count-in-engine.service';
import { SettingsStorageService } from './services/settings-storage.service';

export interface CountInPracticeCopy {
  title: string;
  subtitle: string;
  uploadLabel: string;
  uploadHint: string;
  changeFile: string;
  bpmLabel: string;
  timeSignatureLabel: string;
  preCountLabel: string;
  countOutLabel: string;
  barsUnit: string;
  trimLabel: string;
  start: string;
  end: string;
  play: string;
  pause: string;
  stop: string;
  phasePreCount: string;
  phaseAudio: string;
  phaseCountOut: string;
  bar: string;
  beat: string;
  of: string;
  noAudioHint: string;
  decodeError: string;
}

const COPY: Record<Language, CountInPracticeCopy> = {
  en: {
    title: 'Count-In Practice',
    subtitle: 'Upload a clip, trim it, and loop it behind a metronome count-in and count-out.',
    uploadLabel: 'Upload audio',
    uploadHint: 'MP3, WAV or M4A',
    changeFile: 'Change file',
    bpmLabel: 'BPM',
    timeSignatureLabel: 'Time signature',
    preCountLabel: 'Pre-count bars',
    countOutLabel: 'Count-out bars',
    barsUnit: 'bars',
    trimLabel: 'Trim',
    start: 'Start',
    end: 'End',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    phasePreCount: 'Pre-Count',
    phaseAudio: 'Audio',
    phaseCountOut: 'Count-Out',
    bar: 'Bar',
    beat: 'Beat',
    of: 'of',
    noAudioHint: 'Upload an audio file to begin.',
    decodeError: "That file couldn't be decoded — try a different MP3, WAV or M4A.",
  },
  es: {
    title: 'Práctica de Count-In',
    subtitle: 'Sube un fragmento, recórtalo, y ponlo en loop con un count-in y count-out de metrónomo.',
    uploadLabel: 'Subir audio',
    uploadHint: 'MP3, WAV o M4A',
    changeFile: 'Cambiar archivo',
    bpmLabel: 'BPM',
    timeSignatureLabel: 'Compás',
    preCountLabel: 'Bares de pre-count',
    countOutLabel: 'Bares de count-out',
    barsUnit: 'bares',
    trimLabel: 'Recorte',
    start: 'Inicio',
    end: 'Fin',
    play: 'Reproducir',
    pause: 'Pausar',
    stop: 'Detener',
    phasePreCount: 'Pre-Count',
    phaseAudio: 'Audio',
    phaseCountOut: 'Count-Out',
    bar: 'Bar',
    beat: 'Beat',
    of: 'de',
    noAudioHint: 'Sube un archivo de audio para empezar.',
    decodeError: 'No se pudo decodificar ese archivo — prueba con otro MP3, WAV o M4A.',
  },
};

const TIME_SIGNATURES = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
  { label: '7/8', beats: 7 },
] as const;

const BPM_MIN = 40;
const BPM_MAX = 240;
const BARS_MIN = 0;
const BARS_MAX = 8;

@Component({
  selector: 'the-chords-count-in-practice',
  imports: [FormsModule, WaveformTrimmer],
  templateUrl: './count-in-practice.html',
  styleUrl: './count-in-practice.scss',
  host: { '[attr.lang]': 'language()' },
})
export class CountInPractice {
  private readonly settingsStorage = inject(SettingsStorageService);
  readonly engine = inject(CountInEngineService);

  readonly language = input<Language>('en');
  readonly text = computed(() => COPY[this.language()]);

  readonly timeSignatures = TIME_SIGNATURES;

  private readonly stored = this.settingsStorage.load();
  readonly bpm = signal(this.stored.bpm);
  readonly bpmInputValue = signal(String(this.stored.bpm));
  readonly beatsPerMeasure = signal(this.stored.beatsPerMeasure);
  readonly preCountBars = signal(this.stored.preCountBars);
  readonly countOutBars = signal(this.stored.countOutBars);

  readonly audioFile = signal<File | null>(null);
  readonly hasAudio = signal(false);
  readonly trimRange = signal<TrimRange>({ start: 0, end: 0 });
  readonly errorMessage = signal<string | null>(null);

  readonly beatDots = computed(() => Array.from({ length: this.beatsPerMeasure() }, (_, i) => i));
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
      this.settingsStorage.save(settings);
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.engine.stop();
    this.hasAudio.set(false);
    this.errorMessage.set(null);
    this.audioFile.set(file);
  }

  onWaveformLoaded(loaded: WaveformLoaded): void {
    this.engine.setBuffer(loaded.buffer);
    this.hasAudio.set(true);
  }

  onWaveformError(): void {
    this.hasAudio.set(false);
    this.engine.setBuffer(null);
    this.errorMessage.set(this.text().decodeError);
  }

  onTrimChange(range: TrimRange): void {
    this.trimRange.set(range);
    this.engine.setTrim(range);
  }

  onBpmInput(value: string): void {
    this.bpmInputValue.set(value);
    const parsed = Number(value);
    if (value.trim() !== '' && !Number.isNaN(parsed) && parsed >= BPM_MIN && parsed <= BPM_MAX) {
      this.bpm.set(parsed);
    }
  }

  onBpmBlur(): void {
    const parsed = Number(this.bpmInputValue());
    const clamped = Number.isNaN(parsed) ? this.bpm() : Math.min(BPM_MAX, Math.max(BPM_MIN, parsed));
    this.bpm.set(clamped);
    this.bpmInputValue.set(String(clamped));
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
