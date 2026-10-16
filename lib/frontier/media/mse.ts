import type { FrontierSegment, FrontierVideoVariant } from '@/lib/frontier/types';
import { FrontierThroughputEstimator, chooseFrontierVideoVariant } from './abr';

export type FrontierMseManifest = {
  initUrl: string;
  variants: Array<FrontierVideoVariant & { segments: FrontierSegment[] }>;
};

type BufferOperation =
  | { kind: 'append'; data: ArrayBuffer }
  | { kind: 'remove'; start: number; end: number };

/**
 * Minimal fMP4/CMAF MediaSource controller. It intentionally supports only the
 * normalized FRONTIER manifest rather than attempting to become a full HLS/DASH
 * parser. Native HLS and ordinary progressive sources stay on the native path.
 */
export class FrontierMseController {
  private mediaSource?: MediaSource;
  private sourceBuffer?: SourceBuffer;
  private objectUrl?: string;
  private manifest?: FrontierMseManifest;
  private displayWidth = 960;
  private sourceMimeCodec?: string;
  private readonly abortController = new AbortController();
  private readonly operations: BufferOperation[] = [];
  private readonly throughput = new FrontierThroughputEstimator();
  private activeVariantId?: string;
  private nextSegmentIndex = 0;
  private pumping = false;
  private destroyed = false;

  constructor(private readonly video: HTMLVideoElement) {}

  async attach(manifest: FrontierMseManifest, displayWidth: number): Promise<void> {
    if (this.destroyed) throw new Error('MSE controller destroyed');
    if (typeof MediaSource === 'undefined') throw new Error('MediaSource unavailable');

    this.manifest = manifest;
    this.displayWidth = Math.max(320, displayWidth);
    const initial = this.pickVariant(manifest.variants, this.displayWidth, 10);
    if (!initial) throw new Error('No supported FRONTIER video variant');
    const mimeCodec = `${initial.mimeType}; codecs="${initial.codec}"`;
    if (!MediaSource.isTypeSupported(mimeCodec)) throw new Error(`Unsupported media codec: ${mimeCodec}`);
    this.sourceMimeCodec = mimeCodec;

    const source = new MediaSource();
    this.mediaSource = source;
    this.objectUrl = URL.createObjectURL(source);
    this.video.src = this.objectUrl;

    await new Promise<void>((resolve, reject) => {
      const opened = () => {
        source.removeEventListener('sourceclose', closed);
        resolve();
      };
      const closed = () => {
        source.removeEventListener('sourceopen', opened);
        reject(new Error('MediaSource closed before opening'));
      };
      source.addEventListener('sourceopen', opened, { once: true });
      source.addEventListener('sourceclose', closed, { once: true });
    });

    if (this.destroyed) return;
    const buffer = source.addSourceBuffer(mimeCodec);
    buffer.mode = 'segments';
    buffer.addEventListener('updateend', this.onUpdateEnd);
    this.sourceBuffer = buffer;
    this.activeVariantId = initial.id;

    this.video.addEventListener('timeupdate', this.onPlaybackAdvance);
    this.video.addEventListener('waiting', this.onPlaybackHungry);
    this.video.addEventListener('seeking', this.onPlaybackHungry);

    await this.enqueueUrl(manifest.initUrl);
    await this.pumpSegments(manifest, this.displayWidth);
  }

  async pumpSegments(manifest: FrontierMseManifest, displayWidth: number, targetBufferSeconds = 10): Promise<void> {
    if (this.pumping || this.destroyed) return;
    this.pumping = true;
    try {
      while (!this.destroyed && this.bufferAhead() < targetBufferSeconds) {
        const variant = this.pickVariant(manifest.variants, displayWidth, this.bufferAhead());
        if (!variant) break;

        // FRONTIER variants are expected to be timeline-aligned CMAF renditions
        // with a codec compatible with the active SourceBuffer. A quality switch
        // therefore happens only on the next segment boundary.
        this.activeVariantId = variant.id;
        const segment = variant.segments[this.nextSegmentIndex];
        if (!segment) break;
        await this.enqueueUrl(segment.url);
        this.nextSegmentIndex += 1;
      }
      this.trimBackBuffer();
      this.maybeEndOfStream(manifest);
    } finally {
      this.pumping = false;
    }
  }

  bufferAhead(): number {
    const buffer = this.sourceBuffer;
    if (!buffer || !buffer.buffered.length) return 0;
    const current = this.video.currentTime;
    for (let index = 0; index < buffer.buffered.length; index += 1) {
      const start = buffer.buffered.start(index);
      const end = buffer.buffered.end(index);
      if (current >= start && current <= end) return Math.max(0, end - current);
    }
    return 0;
  }

  trimBackBuffer(retainSeconds = 6): void {
    const buffer = this.sourceBuffer;
    if (!buffer || !buffer.buffered.length) return;
    const removeBefore = this.video.currentTime - retainSeconds;
    if (removeBefore <= 0) return;
    const firstStart = buffer.buffered.start(0);
    if (removeBefore > firstStart + 0.5) {
      const alreadyQueued = this.operations.some((operation) => operation.kind === 'remove');
      if (!alreadyQueued) this.operations.push({ kind: 'remove', start: firstStart, end: removeBefore });
    }
    this.flushOperations();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController.abort();
    this.operations.length = 0;
    this.video.removeEventListener('timeupdate', this.onPlaybackAdvance);
    this.video.removeEventListener('waiting', this.onPlaybackHungry);
    this.video.removeEventListener('seeking', this.onPlaybackHungry);
    this.sourceBuffer?.removeEventListener('updateend', this.onUpdateEnd);
    try { this.sourceBuffer?.abort(); } catch {}
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
    this.sourceBuffer = undefined;
    this.mediaSource = undefined;
    this.manifest = undefined;
  }

  private readonly onUpdateEnd = () => {
    this.flushOperations();
    if (this.manifest) this.maybeEndOfStream(this.manifest);
  };

  private readonly onPlaybackAdvance = () => {
    if (!this.manifest || this.destroyed) return;
    if (this.bufferAhead() < 7) void this.pumpSegments(this.manifest, this.displayWidth, 11);
    else this.trimBackBuffer();
  };

  private readonly onPlaybackHungry = () => {
    if (!this.manifest || this.destroyed) return;
    void this.pumpSegments(this.manifest, this.displayWidth, 14);
  };

  private pickVariant(
    variants: Array<FrontierVideoVariant & { segments: FrontierSegment[] }>,
    displayWidth: number,
    bufferSeconds: number
  ) {
    const supported = variants.filter((variant) => {
      if (typeof MediaSource === 'undefined') return false;
      const mimeCodec = `${variant.mimeType}; codecs="${variant.codec}"`;
      if (!MediaSource.isTypeSupported(mimeCodec)) return false;
      return !this.sourceMimeCodec || mimeCodec === this.sourceMimeCodec;
    });
    const measured = this.throughput.rawBandwidthBps();
    const fallbackBandwidth = measured > 0 ? measured : 4_000_000;
    return chooseFrontierVideoVariant(supported, fallbackBandwidth, displayWidth, this.activeVariantId, bufferSeconds) as
      | (FrontierVideoVariant & { segments: FrontierSegment[] })
      | undefined;
  }

  private async enqueueUrl(url: string): Promise<void> {
    const started = performance.now();
    const response = await fetch(url, { signal: this.abortController.signal, cache: 'force-cache' });
    if (!response.ok) throw new Error(`Media segment ${response.status}`);
    const data = await response.arrayBuffer();
    this.throughput.sample(data.byteLength, performance.now() - started);
    this.operations.push({ kind: 'append', data });
    this.flushOperations();
    await this.waitForDrain();
  }

  private flushOperations(): void {
    const buffer = this.sourceBuffer;
    if (!buffer || buffer.updating || !this.operations.length || this.destroyed) return;
    const next = this.operations.shift();
    if (!next) return;
    try {
      if (next.kind === 'append') buffer.appendBuffer(next.data);
      else buffer.remove(next.start, next.end);
    } catch {
      // Quota/transition pressure remains local to the player. Playback can
      // continue from already-buffered media, and a later timeupdate can refill.
    }
  }

  private maybeEndOfStream(manifest: FrontierMseManifest): void {
    const source = this.mediaSource;
    const buffer = this.sourceBuffer;
    if (!source || !buffer || source.readyState !== 'open' || buffer.updating || this.operations.length) return;
    const maximumSegments = Math.max(0, ...manifest.variants.map((variant) => variant.segments.length));
    if (this.nextSegmentIndex < maximumSegments) return;
    try { source.endOfStream(); } catch {}
  }

  private async waitForDrain(): Promise<void> {
    const buffer = this.sourceBuffer;
    if (!buffer || (!buffer.updating && !this.operations.length)) return;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.destroyed || (!buffer.updating && !this.operations.length)) resolve();
        else window.setTimeout(check, 12);
      };
      check();
    });
  }
}
