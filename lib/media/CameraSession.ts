import { sharedCameraBroker, type CameraLease } from './CameraBroker';

export class CameraSession {
  private lease: CameraLease | null = null;
  private video: HTMLVideoElement | null = null;
  private generation = 0;

  async start(video: HTMLVideoElement, constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    const generation = ++this.generation;
    this.stopCurrentLease();

    const lease = await sharedCameraBroker.acquire(constraints);
    if (generation !== this.generation) {
      lease.release();
      throw new Error('Camera session was superseded before it became active.');
    }

    this.lease = lease;
    this.video = video;
    video.srcObject = lease.stream;
    video.muted = true;
    video.playsInline = true;

    try {
      await video.play();
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
    return video;
  }

  async startDetached(constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    return this.start(video, constraints);
  }

  stop(): void {
    this.generation += 1;
    this.stopCurrentLease();
  }

  private stopCurrentLease(): void {
    const video = this.video;
    this.video = null;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    this.lease?.release();
    this.lease = null;
  }

  get active(): boolean {
    return Boolean(this.lease?.stream.active);
  }
}
