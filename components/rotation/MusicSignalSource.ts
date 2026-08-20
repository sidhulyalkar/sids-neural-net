import { PlaybackClock } from '../perceptual-cortex/playbackClock';

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

export type PlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
const API_LOAD_TIMEOUT_MS = 8000;
const CONTROLLER_TIMEOUT_MS = 8000;

function loadIframeApi(): Promise<IFrameAPI> {
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for Spotify iframe API to load')), API_LOAD_TIMEOUT_MS);
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
  private destroyed = false;
  private state: PlaybackState = 'loading';
  private listeners = new Set<(state: PlaybackState) => void>();
  private currentUri: string;

  private constructor(private controller: EmbedController, uri: string) {
    this.currentUri = uri;
    controller.addListener('ready', () => this.setState('ready'));
    controller.addListener('playback_started', () => this.setState('playing'));
    controller.addListener('playback_update', (event) => {
      const data = event.data;
      if (data.playingURI && data.playingURI !== this.currentUri) this.currentUri = data.playingURI;
      this.clock.update(data.position, data.isPaused, performance.now());
      this.setState(data.isPaused ? 'paused' : 'playing');
    });
  }

  private setState(next: PlaybackState) {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  static async create(element: HTMLElement, uri: string): Promise<MusicPlaybackController> {
    const api = await loadIframeApi();
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Spotify createController timed out'));
        }
      }, CONTROLLER_TIMEOUT_MS);
      api.createController(element, { uri, width: '100%', height: 80 }, (controller) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(new MusicPlaybackController(controller, uri));
      });
    });
  }

  subscribe(listener: (state: PlaybackState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  loadTrack(uri: string) {
    this.currentUri = uri;
    this.clock.reset(performance.now());
    this.setState('ready');
    this.controller.loadUri(uri);
  }

  play() {
    this.controller.play();
  }

  pause() {
    this.controller.pause();
  }

  getPositionMs() {
    return this.clock.positionMs(performance.now());
  }

  get isPlaying() {
    return this.clock.isPlaying;
  }

  get playbackState() {
    return this.state;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.listeners.clear();
    this.controller.destroy();
  }
}
