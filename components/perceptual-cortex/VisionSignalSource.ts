import { CameraSession } from '@/lib/media/CameraSession';
import type { FaceFeatures, HandFeatures } from './visionFeatures';

export type VisionSignalOptions = { hands?: boolean; face?: boolean };

export const FRONTIER_FACE_ONLY_VISION_SAMPLE_EVENT = 'frontier:face-only-vision-sample';
export type FrontierFaceOnlyVisionSample = {
  sampleAt: number;
  wallAt: number;
  faceObservable: boolean;
};

export class VisionSignalSource {
  private camera = new CameraSession();
  private video: HTMLVideoElement | null = null;
  private worker: Worker | null = null;
  private timer = 0;
  private busy = false;

  async enable(
    onFeatures: (hands: HandFeatures, face: FaceFeatures) => void,
    onError: (message: string) => void,
    options: VisionSignalOptions = {}
  ) {
    this.video = await this.camera.startDetached({ width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' });
    this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    const faceOnly = options.hands === false && options.face !== false;
    this.worker.onmessage = (event) => {
      if (event.data.type === 'features') {
        onFeatures(event.data.hands, event.data.face);
        if (faceOnly) {
          const detail: FrontierFaceOnlyVisionSample = {
            sampleAt: performance.now(),
            wallAt: Date.now(),
            faceObservable: Boolean(event.data.face?.active),
          };
          window.dispatchEvent(new CustomEvent(FRONTIER_FACE_ONLY_VISION_SAMPLE_EVENT, { detail }));
        }
      }
      if (event.data.type === 'error') onError(event.data.message);
      if (event.data.type === 'consumed') this.busy = false;
    };
    this.worker.postMessage({ type: 'init', hands: options.hands !== false, face: options.face !== false });
    this.timer = window.setInterval(async () => {
      if (this.busy || !this.video || this.video.readyState < 2 || document.hidden) return;
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
    this.worker?.postMessage({ type: 'close' });
    this.worker?.terminate();
    this.worker = null;
    this.camera.stop();
    this.video = null;
    this.busy = false;
  }
}
