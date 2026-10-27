import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Language, Theme } from '../../models';
import { CountInEngineService } from '../../services/count-in-engine.service';
import { CountInStore } from '../../services/count-in-store.service';
import { YoutubePlayer } from '../youtube-player/youtube-player';

const COPY = {
  en: {
    preCount: 'Pre-Count',
    audio: 'Audio',
    countOut: 'Count-Out',
    bar: 'Bar',
    of: 'of',
    region: 'Count-In playing',
    back: 'Back to Count-In',
    stop: 'Stop count-in',
    loadError: "This video can't be played here.",
  },
  es: {
    preCount: 'Pre-Count',
    audio: 'Audio',
    countOut: 'Count-Out',
    bar: 'Compás',
    of: 'de',
    region: 'Count-In en reproducción',
    back: 'Volver a Count-In',
    stop: 'Detener count-in',
    loadError: 'Este video no se puede reproducir aquí.',
  },
} satisfies Record<Language, Record<string, string>>;

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Mount once in the app shell, outside the router outlet. It owns the one
// YouTube player so the video outlives the Count-In page: moving an iframe in
// the DOM reloads it, so the player never moves. It's placed over the page's
// slot while the page is open, docks as a mini player in the corner while the
// loop keeps going elsewhere (desktop), and waits offscreen otherwise. Narrow
// screens have no room for a dock: leaving pauses, coming back resumes.
@Component({
  selector: 'the-chords-count-in-youtube-host',
  imports: [YoutubePlayer],
  host: { '[attr.data-theme]': 'theme()', '[attr.lang]': 'language()' },
  template: `
    @if (store.source() === 'youtube' && store.youtubeVideoId(); as videoId) {
      <div #frame class="frame" [class]="mode()">
        @if (mode() === 'mini') {
          <div class="bar" role="region" [attr.aria-label]="text().region">
            <p class="readout">
              <span class="phase">{{ phaseLabel() }} · {{ text().bar }} {{ engine.barInPhase() }} {{ text().of }} {{ engine.barsInPhase() }}</span>
              <span class="range">{{ rangeLabel() }}</span>
            </p>
            <button type="button" [attr.aria-label]="text().back" [title]="text().back" (click)="returnRequested.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 5h5v5" /><path d="M19 5l-7 7" />
                <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
              </svg>
            </button>
            <button type="button" [attr.aria-label]="text().stop" [title]="text().stop" (click)="engine.stop()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        }
        <the-chords-youtube-player
          #player
          [videoId]="videoId"
          (ready)="store.onYoutubeReady(player, $event)"
          (loadError)="store.onYoutubeError(text().loadError)"
        />
      </div>
    }
  `,
  styleUrl: './youtube-host.scss',
})
export class CountInYoutubeHost {
  readonly engine = inject(CountInEngineService);
  readonly store = inject(CountInStore);

  readonly language = input<Language>('en');
  readonly theme = input<Theme>('dark');
  // The mini player's "back" button; the app navigates to its Count-In route.
  readonly returnRequested = output<void>();
  readonly text = computed(() => COPY[this.language()]);

  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly desktop = signal(true);

  readonly mode = computed(() =>
    this.store.youtubeSlot() ? 'slot' : this.engine.transport() !== 'idle' && this.desktop() ? 'mini' : 'hidden',
  );
  readonly phaseLabel = computed(() => {
    const phase = this.engine.phase();
    return phase === 'preCount' ? this.text().preCount : phase === 'audio' ? this.text().audio : this.text().countOut;
  });
  readonly rangeLabel = computed(() => {
    const { start, end } = this.store.youtubeRange();
    return `${formatTime(start)} – ${formatTime(end)}`;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.store.hostPresent.set(true);
    destroyRef.onDestroy(() => this.store.hostPresent.set(false));

    const query = matchMedia('(min-width: 600px)');
    this.desktop.set(query.matches);
    const onChange = (event: MediaQueryListEvent) => this.desktop.set(event.matches);
    query.addEventListener('change', onChange);
    destroyRef.onDestroy(() => query.removeEventListener('change', onChange));

    // Follow the slot every frame: it moves with scrolling and layout. Absolute
    // (not fixed) positioning so the browser scrolls frame and slot together.
    effect((onCleanup) => {
      const slot = this.store.youtubeSlot();
      const frame = this.frame()?.nativeElement;
      if (!slot || !frame) return;
      let raf = 0;
      let top = 0;
      let left = 0;
      const follow = () => {
        const target = slot.getBoundingClientRect();
        const current = frame.getBoundingClientRect();
        // Relative to where the frame is now, whatever its containing block.
        top += target.top - current.top;
        left += target.left - current.left;
        frame.style.top = `${top}px`;
        frame.style.left = `${left}px`;
        frame.style.width = `${target.width}px`;
        frame.style.height = `${target.height}px`;
        raf = requestAnimationFrame(follow);
      };
      follow();
      onCleanup(() => {
        cancelAnimationFrame(raf);
        frame.removeAttribute('style');
      });
    });

    let pausedByLeaving = false;
    effect(() => {
      const onPage = this.store.youtubeSlot() !== null;
      untracked(() => {
        if (!onPage && !this.desktop() && this.engine.transport() === 'playing' && this.store.source() === 'youtube') {
          this.engine.pause();
          pausedByLeaving = true;
        } else if (onPage && pausedByLeaving) {
          pausedByLeaving = false;
          if (this.engine.transport() === 'paused') this.engine.start();
        }
      });
    });
  }
}
