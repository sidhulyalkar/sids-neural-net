type CameraLease = {
  stream: MediaStream;
  release: () => void;
};

type SharedCameraEntry = {
  stream: MediaStream;
  refs: number;
};

const sharedStreams = new Map<string, SharedCameraEntry>();
const pendingStreams = new Map<string, Promise<SharedCameraEntry>>();

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function cameraKey(constraints: MediaTrackConstraints): string {
  return stableSerialize({ video: constraints, audio: false });
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

async function acquireSharedCamera(constraints: MediaTrackConstraints): Promise<CameraLease> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is unavailable in this browser.');
  }

  const key = cameraKey(constraints);
  let entry = sharedStreams.get(key);
  if (entry && !entry.stream.active) {
    sharedStreams.delete(key);
    entry = undefined;
  }

  if (!entry) {
    let pending = pendingStreams.get(key);
    if (!pending) {
      pending = navigator.mediaDevices.getUserMedia({ video: constraints, audio: false }).then((stream) => {
        const created = { stream, refs: 0 } satisfies SharedCameraEntry;
        sharedStreams.set(key, created);
        for (const track of stream.getTracks()) {
          track.addEventListener?.('ended', () => {
            if (sharedStreams.get(key)?.stream === stream) sharedStreams.delete(key);
          }, { once: true });
        }
        return created;
      }).finally(() => {
        pendingStreams.delete(key);
      });
      pendingStreams.set(key, pending);
    }
    entry = await pending;
  }

  entry.refs += 1;
  let released = false;
  return {
    stream: entry.stream,
    release: () => {
      if (released) return;
      released = true;
      entry!.refs = Math.max(0, entry!.refs - 1);
      if (entry!.refs > 0) return;
      if (sharedStreams.get(key) === entry) sharedStreams.delete(key);
      stopStream(entry!.stream);
    },
  };
}

/**
 * A lightweight lease over the site-wide user-facing camera stream. Multiple local
 * vision features can read the same MediaStream without racing getUserMedia or
 * stopping each other's tracks. The physical stream closes when the final lease
 * releases it.
 */
export class CameraSession {
  private lease: CameraLease | null = null;
  private video: HTMLVideoElement | null = null;

  async start(video: HTMLVideoElement, constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    this.stop();
    const lease = await acquireSharedCamera(constraints);
    this.lease = lease;
    this.video = video;
    video.srcObject = lease.stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch (error) {
      this.stop();
      throw error;
    }
    return video;
  }

  async startDetached(constraints: MediaTrackConstraints): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    return this.start(video, constraints);
  }

  stop(): void {
    this.lease?.release();
    this.lease = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
  }

  get active(): boolean {
    return Boolean(this.lease?.stream.active);
  }
}