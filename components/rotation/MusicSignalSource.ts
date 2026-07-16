import { PlaybackClock } from '../perceptual-cortex/playbackClock';

// Minimal ambient shape of the Spotify iFrame API (no official types published).
type PlaybackData = { position: number; duration: number; isPaused: boolean; playingURI: string };
type EmbedController = {
  addListener: (event: 'ready' | 'playback_started' | 'playback_update', cb: (e: { data: PlaybackData }) => void) => void;
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  destroy: () => void;
};
type IFrameAPI = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: EmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
    __spotifyIframeApi?: IFrameAPI;
  }
}

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
const API_LOAD_TIMEOUT_MS = 8000;

function loadIframeApi(): Promise<IFrameAPI> {
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for Spotify iframe API to load'));
    }, API_LOAD_TIMEOUT_MS);
    const prior = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timeout);
      window.__spotifyIframeApi = api;
      prior?.(api);
      resolve(api);
    };
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Spotify iframe API script'));
      };
      document.body.appendChild(script);
    }
  });
}

export class MusicPlaybackController {
  private clock = new PlaybackClock();
  private constructor(private controller: EmbedController) {
    controller.addListener('playback_update', (e) => {
      this.clock.update(e.data.position, e.data.isPaused, performance.now());
    });
  }

  static async create(element: HTMLElement, uri: string): Promise<MusicPlaybackController> {
    const api = await loadIframeApi();
    return new Promise((resolve) => {
      api.createController(element, { uri, width: '100%', height: 80 }, (controller) => {
        resolve(new MusicPlaybackController(controller));
      });
    });
  }

  loadTrack(uri: string) { this.controller.loadUri(uri); }
  play() { this.controller.play(); }
  pause() { this.controller.pause(); }
  getPositionMs() { return this.clock.positionMs(performance.now()); }
  get isPlaying() { return this.clock.isPlaying; }
  destroy() { this.controller.destroy(); }
}
