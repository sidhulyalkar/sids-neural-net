import type { FrontierVideoVariant } from '@/lib/frontier/types';

export class FrontierThroughputEstimator {
  private estimateBps = 0;

  sample(bytes: number, elapsedMs: number): void {
    if (!Number.isFinite(bytes) || bytes <= 0 || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    const bitsPerSecond = (bytes * 8 * 1_000) / Math.max(1, elapsedMs);
    this.estimateBps = this.estimateBps === 0
      ? bitsPerSecond
      : this.estimateBps * 0.72 + bitsPerSecond * 0.28;
  }

  safeBandwidthBps(): number {
    return this.estimateBps * 0.72;
  }

  rawBandwidthBps(): number {
    return this.estimateBps;
  }
}

export function chooseFrontierVideoVariant(
  variants: FrontierVideoVariant[],
  bandwidthBps: number,
  displayWidth: number,
  currentVariantId?: string,
  bufferSeconds = 8
): FrontierVideoVariant | undefined {
  if (!variants.length) return undefined;
  const ordered = [...variants].sort((a, b) => a.bitrate - b.bitrate);
  const current = currentVariantId ? ordered.find((variant) => variant.id === currentVariantId) : undefined;

  // Protect playback first. A shallow buffer immediately biases downward.
  const safety = bufferSeconds < 2.5 ? 0.58 : bufferSeconds < 5 ? 0.68 : 0.78;
  const budget = Math.max(0, bandwidthBps * safety);
  const widthCap = Math.max(320, displayWidth * 1.5);
  const eligible = ordered.filter((variant) => variant.bitrate <= budget && variant.width <= widthCap);
  const candidate = eligible.at(-1) ?? ordered[0];

  if (!current || !candidate) return candidate;
  if (candidate.bitrate < current.bitrate) return candidate;

  // Hysteresis: only upgrade with a healthy buffer and meaningful headroom.
  if (candidate.bitrate > current.bitrate) {
    if (bufferSeconds < 8) return current;
    if (budget < candidate.bitrate * 1.18) return current;
  }
  return candidate;
}
