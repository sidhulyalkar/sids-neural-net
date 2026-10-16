export type CameraLease = {
  stream: MediaStream;
  release: () => void;
};

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

function defaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('Camera access is unavailable in this browser.'));
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

function streamUsable(stream: MediaStream | null): stream is MediaStream {
  return Boolean(stream?.active && stream.getVideoTracks().some((track) => track.readyState === 'live'));
}

/**
 * One browser-local camera authority shared by every feature that needs video.
 *
 * Consumers receive leases over the same MediaStream. A consumer may detach its
 * own <video> element without stopping the physical track. The physical stream is
 * stopped only after the final lease is released.
 *
 * This intentionally treats subsequent constraints as preferences rather than a
 * reason to open a second camera stream. FRONTIER inference and appearance
 * sampling do not require independent capture devices, and a single stream avoids
 * permission churn and cross-feature track termination.
 */
export class CameraBroker {
  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream> | null = null;
  private leases = new Set<symbol>();

  constructor(private readonly getUserMedia: GetUserMedia = defaultGetUserMedia) {}

  async acquire(video: MediaTrackConstraints): Promise<CameraLease> {
    const token = Symbol('camera-lease');
    const stream = await this.ensureStream(video);
    this.leases.add(token);
    let released = false;

    return {
      stream,
      release: () => {
        if (released) return;
        released = true;
        this.leases.delete(token);
        if (this.leases.size === 0) this.stopPhysicalStream();
      },
    };
  }

  private async ensureStream(video: MediaTrackConstraints): Promise<MediaStream> {
    if (streamUsable(this.stream)) return this.stream;
    if (!this.pending) {
      this.pending = this.getUserMedia({ video, audio: false })
        .then((stream) => {
          this.stream = stream;
          for (const track of stream.getVideoTracks()) {
            track.addEventListener?.('ended', () => {
              if (this.stream === stream) this.stream = null;
            }, { once: true });
          }
          return stream;
        })
        .finally(() => {
          this.pending = null;
        });
    }
    return this.pending;
  }

  private stopPhysicalStream(): void {
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach((track) => track.stop());
  }

  /** Test/diagnostic seam. Production consumers should release their lease. */
  shutdown(): void {
    this.leases.clear();
    this.stopPhysicalStream();
  }

  get activeLeaseCount(): number {
    return this.leases.size;
  }

  get active(): boolean {
    return streamUsable(this.stream);
  }
}

export const sharedCameraBroker = new CameraBroker();
