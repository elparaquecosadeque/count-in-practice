import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import type { YoutubePlayer } from '../components/youtube-player/youtube-player';
import type { WaveformSession } from '../components/waveform-trimmer/waveform-trimmer';
import { AudioSource, CountInSettings, TrimRange, defaultAccents } from '../models';
import { SilenceTrimMode } from '../silence';
import { parseYouTubeId } from '../youtube';
import { CountInEngineService } from './count-in-engine.service';
import { SettingsStorageService } from './settings-storage.service';

// Everything the page shows that must outlive the page itself: settings, the
// loaded file (with its trim/crop history) and the YouTube video. The page
// component is only a view onto this, so leaving the route and coming back
// finds the same state — and a loop that keeps playing meanwhile (the engine
// is root-provided too). A host app can also read and write the settings
// signals, e.g. to share BPM and meter with its own metronome.
@Injectable({ providedIn: 'root' })
export class CountInStore {
  private readonly engine = inject(CountInEngineService);
  private readonly settingsStorage = inject(SettingsStorageService);
  private readonly stored = this.settingsStorage.load();

  readonly bpm = signal(this.stored.bpm);
  readonly beatsPerMeasure = signal(this.stored.beatsPerMeasure);
  readonly accents = signal(this.stored.accents);
  readonly preCountBars = signal(this.stored.preCountBars);
  readonly countOutBars = signal(this.stored.countOutBars);
  readonly silenceThresholdDb = signal(this.stored.silenceThresholdDb);
  readonly silenceMode = signal<SilenceTrimMode>('both');
  readonly youtubeLeadMs = signal(this.stored.youtubeLeadMs);

  readonly source = signal<AudioSource>(this.stored.source);

  readonly audioFile = signal<File | null>(null);
  readonly audioBuffer = signal<AudioBuffer | null>(null);
  readonly waveformSession = signal<WaveformSession | null>(null);
  readonly trimRange = signal<TrimRange>({ start: 0, end: 0 });
  readonly canUndoCrop = signal(false);
  readonly canUndoSilence = signal(false);

  readonly youtubeUrl = signal(this.stored.youtubeUrl);
  readonly youtubeVideoId = signal<string | null>(parseYouTubeId(this.stored.youtubeUrl));
  readonly youtubeDuration = signal<number | null>(null); // null until the player is ready
  readonly youtubeRange = signal<TrimRange>(this.stored.youtubeRange);
  readonly youtubeError = signal<string | null>(null);
  // The ready player, wherever it's mounted (inline or in a CountInYoutubeHost).
  youtubePlayer: YoutubePlayer | null = null;

  // Set while a CountInYoutubeHost is mounted in the app shell: the page then
  // renders an empty slot and the host places the one player over it.
  readonly hostPresent = signal(false);
  readonly youtubeSlot = signal<HTMLElement | null>(null);

  constructor() {
    effect(() => {
      const settings: CountInSettings = {
        bpm: this.bpm(),
        beatsPerMeasure: this.beatsPerMeasure(),
        accents: this.accents(),
        preCountBars: this.preCountBars(),
        countOutBars: this.countOutBars(),
      };
      this.engine.setSettings(settings);
      this.engine.setExternalLead(this.youtubeLeadMs() / 1000);
      this.settingsStorage.save({
        ...settings,
        silenceThresholdDb: this.silenceThresholdDb(),
        youtubeLeadMs: this.youtubeLeadMs(),
        source: this.source(),
        youtubeUrl: this.youtubeVideoId() ? this.youtubeUrl() : '',
        youtubeRange: this.youtubeRange(),
      });
    });
    // The meter can change from outside (a host's metronome): the accent
    // pattern must always have one entry per beat.
    effect(() => {
      const beats = this.beatsPerMeasure();
      if (untracked(this.accents).length !== beats) this.accents.set(defaultAccents(beats));
    });
  }

  // Leaving a source unmounts its view; the file's trimmer restores from its
  // session and re-emits loaded/trimChange, the YouTube player re-emits ready.
  setSource(source: AudioSource): void {
    this.engine.stop();
    this.engine.setBuffer(null);
    this.engine.setExternal(null);
    this.audioBuffer.set(null);
    this.youtubeDuration.set(null);
    this.youtubePlayer = null;
    this.source.set(source);
  }

  loadFile(file: File): void {
    if (this.source() !== 'file') this.setSource('file');
    this.engine.stop();
    this.audioBuffer.set(null);
    this.audioFile.set(file);
    this.waveformSession.set({ file, current: null, previous: null, range: null, rangeBeforeSilence: null });
  }

  // Returns false for a link that isn't YouTube's.
  loadYoutube(url: string): boolean {
    const id = parseYouTubeId(url);
    if (!id) return false;
    this.youtubeError.set(null);
    if (id === this.youtubeVideoId()) return true;
    this.engine.stop();
    this.engine.setExternal(null);
    this.youtubePlayer = null;
    this.youtubeDuration.set(null);
    this.youtubeRange.set({ start: 0, end: 0 });
    this.youtubeVideoId.set(id);
    return true;
  }

  onYoutubeReady(player: YoutubePlayer, duration: number): void {
    this.youtubePlayer = player;
    this.youtubeDuration.set(duration);
    // A stored or remounted range is kept; a fresh video gets all of it.
    const range = this.youtubeRange();
    if (range.end === 0) this.youtubeRange.set({ start: 0, end: duration });
    this.engine.setExternal(player);
    this.engine.setTrim(this.youtubeRange());
  }

  onYoutubeError(message: string): void {
    this.youtubeDuration.set(null);
    this.youtubeError.set(message);
  }

  // Seconds rounded to centiseconds; YouTube reports 0 for durations it doesn't know yet.
  setYoutubeEdge(edge: keyof TrimRange, value: number): void {
    const max = this.youtubeDuration() || Infinity;
    const range = { ...this.youtubeRange(), [edge]: Math.round(Math.min(max, Math.max(0, value)) * 100) / 100 };
    this.youtubeRange.set(range);
    this.engine.setTrim(range);
  }
}
