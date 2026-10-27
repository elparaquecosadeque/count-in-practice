import { Component, ElementRef, effect, inject, input, output } from '@angular/core';
import { ExternalAudio } from '../../services/count-in-engine.service';
import { CUED, PLAYING, UNSTARTED, YouTubePlayerApi, loadYouTubeApi } from '../../youtube';

// Official YouTube embed. Its audio never reaches our AudioContext, so the
// engine drives it as an ExternalAudio: seek + play/pause at the right moments.
@Component({
  selector: 'the-chords-youtube-player',
  template: '',
  styles: `
    :host {
      display: block;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 12px;
      background: #000;
    }

    :host ::ng-deep iframe {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class YoutubePlayer implements ExternalAudio {
  readonly videoId = input.required<string>();
  // Video duration in seconds (0 if YouTube doesn't know it yet).
  readonly ready = output<number>();
  readonly loadError = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private player: YouTubePlayerApi | null = null;
  // True while a muted warm-up play is buffering the cue position.
  private warming = false;
  private unmuteAfterWarmUp = false;

  constructor() {
    effect((onCleanup) => {
      const videoId = this.videoId();
      let created: YouTubePlayerApi | null = null;
      let cancelled = false;
      loadYouTubeApi().then(
        (YT) => {
          if (cancelled) return;
          // The API replaces this element with its iframe.
          const target = document.createElement('div');
          this.host.append(target);
          created = new YT.Player(target, {
            videoId,
            playerVars: { playsinline: 1, rel: 0 },
            events: {
              onReady: () => {
                this.player = created;
                this.ready.emit(created!.getDuration());
              },
              onError: () => this.loadError.emit(),
              onStateChange: ({ data }) => {
                if (this.warming && data === PLAYING) this.endWarmUp(true);
              },
            },
          });
        },
        () => !cancelled && this.loadError.emit(),
      );
      onCleanup(() => {
        cancelled = true;
        created?.destroy();
        this.host.replaceChildren();
        this.player = null;
        this.warming = false;
      });
    });
  }

  currentTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }

  play(position: number): void {
    if (this.warming) this.endWarmUp(false);
    this.player?.seekTo(position, true);
    this.player?.playVideo();
  }

  pause(): void {
    if (this.warming) this.endWarmUp(false);
    this.player?.pauseVideo();
  }

  // A paused video buffers on seek; a never-played one doesn't, so it's
  // played muted until it actually starts, then paused (during Pre-Count).
  cue(position: number): void {
    const player = this.player;
    if (!player) return;
    const state = player.getPlayerState();
    player.seekTo(position, true);
    if (state === CUED || state === UNSTARTED) {
      this.warming = true;
      this.unmuteAfterWarmUp = !player.isMuted();
      player.mute();
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }

  private endWarmUp(pause: boolean): void {
    this.warming = false;
    if (pause) this.player?.pauseVideo();
    if (this.unmuteAfterWarmUp) this.player?.unMute();
  }
}
