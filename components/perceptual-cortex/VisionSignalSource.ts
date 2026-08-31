import { CameraSession } from '@/lib/media/CameraSession';
import type { FaceFeatures, HandFeatures } from './visionFeatures';

export type VisionSignalOptions = {
  hands?: boolean;
};

export class VisionSignalSource {
  private camera = new CameraSession();
  private video: HTMLVideoElement | null = null;
  private worker: Worker | null = null;
  private timer = 0;
  private busy = false;
  private ready = false;

  async enable(
    onFeatures: (hands: HandFeatures, face: FaceFeatures) => void,
    onError: (message: string) => void,
    options: VisionSignalOptions = {},
  ) {
    this.disable();
    this.video = await this.camera.startDetached({ width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' });
    this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event) => {
      if (event.data.type === 'ready') this.ready = true;
      if (event.data.type === 'features') onFeatures(event.data.hands, event.data.face);
      if (event.data.type === 'error') onError(event.data.message);
      if (event.data.type === 'consumed') this.busy = false;
    };
    this.worker.postMessage({ type: 'init', hands: options.hands !== false });
    this.timer = window.setInterval(async () => {
      if (!this.ready || this.busy || !this.video || this.video.readyState < 2 || document.hidden) return;
      this.busy = true;
      try {
        const bitmap = await createImageBitmap(this.video);
        this.worker?.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap]);
      } catch {
        this.busy = false;
      }
    }, 1000 / 15);
  }

  disable() {
    clearInterval(this.timer);
    this.timer = 0;
    this.worker?.postMessage({ type: 'close' });
    this.worker?.terminate();
    this.worker = null;
    this.camera.stop();
    this.video = null;
    this.busy = false;
    this.ready = false;
  }
}
