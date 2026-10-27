// Accepts watch, youtu.be, embed, shorts and live links, or a bare video id.
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:.*[?&]v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(value);
  return match?.[1] ?? null;
}

// The few IFrame Player API members used here (no @types/youtube dependency).
export interface YouTubePlayerApi {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getDuration(): number;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number>;
      events?: { onReady?: () => void; onError?: () => void; onStateChange?: (event: { data: number }) => void };
    },
  ) => YouTubePlayerApi;
}

type YouTubeWindow = Window & { YT?: YouTubeNamespace; onYouTubeIframeAPIReady?: () => void };

// YT.PlayerState values.
export const UNSTARTED = -1;
export const PLAYING = 1;
export const CUED = 5;

let api: Promise<YouTubeNamespace> | null = null;

// Loads https://www.youtube.com/iframe_api once per page.
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  api ??= new Promise((resolve, reject) => {
    const win = window as YouTubeWindow;
    if (win.YT?.Player) return resolve(win.YT);
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(win.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      api = null; // allow a retry, e.g. after coming back online
      script.remove();
      reject(new Error('YouTube API failed to load'));
    };
    document.head.append(script);
  });
  return api;
}
