export class CameraSession {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async start(video: HTMLVideoElement, constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is unavailable in this browser.');
    }
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    return video;
  }

  async startDetached(constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    return this.start(video, constraints);
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
  }

  get active(): boolean {
    return Boolean(this.stream?.active);
  }
}
