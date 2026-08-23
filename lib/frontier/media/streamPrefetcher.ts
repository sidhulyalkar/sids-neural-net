import type { FrontierVideoStream } from '@/lib/frontier/types';

export type FrontierPrefetchKind = 'image' | 'video';

export type FrontierPrefetchTarget = {
  id: string;
  kind: FrontierPrefetchKind;
  node: HTMLElement;
  warm: () => void | Promise<void>;
};

type SchedulerApi = {
  postTask<T>(callback: () => T | Promise<T>, options?: { priority?: 'background' | 'user-visible' | 'user-blocking' }): Promise<T>;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const targets = new Map<string, FrontierPrefetchTarget>();

export function registerFrontierPrefetchTarget(target: FrontierPrefetchTarget): () => void {
  targets.set(target.id, target);
  return () => {
    const current = targets.get(target.id);
    if (current === target) targets.delete(target.id);
  };
}

export function frontierPrefetchTargets(): FrontierPrefetchTarget[] {
  return [...targets.values()].filter((target) => target.node.isConnected);
}

export function shouldPrefetchMedia(): boolean {
  if (typeof window === 'undefined' || document.visibilityState === 'hidden') return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData) return false;
  return connection?.effectiveType !== 'slow-2g';
}

export function scheduleFrontierPrefetch(task: () => void | Promise<void>): () => void {
  if (typeof window === 'undefined' || !shouldPrefetchMedia()) return () => undefined;
  let cancelled = false;
  const run = async () => {
    if (cancelled || !shouldPrefetchMedia()) return;
    try { await task(); } catch { /* Prefetch is always best-effort. */ }
  };

  const scheduler = (globalThis as typeof globalThis & { scheduler?: SchedulerApi }).scheduler;
  if (scheduler?.postTask) {
    void scheduler.postTask(run, { priority: 'background' });
    return () => { cancelled = true; };
  }

  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(() => { void run(); }, { timeout: 220 });
    return () => {
      cancelled = true;
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const handle = window.setTimeout(() => { void run(); }, 32);
  return () => {
    cancelled = true;
    window.clearTimeout(handle);
  };
}

export function predictViewportIntersection(
  rect: Pick<DOMRect, 'top' | 'bottom'>,
  scrollVelocityPxPerMs: number,
  viewportHeight: number,
  horizonMs = 300,
  marginPx = 96
): boolean {
  const displacement = scrollVelocityPxPerMs * horizonMs;
  const futureTop = rect.top - displacement;
  const futureBottom = rect.bottom - displacement;
  return futureBottom >= -marginPx && futureTop <= viewportHeight + marginPx;
}

export function predictPointerIntersection(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  pointer: { x: number; y: number; vx: number; vy: number },
  horizonMs = 300,
  marginPx = 54
): boolean {
  const x = pointer.x + pointer.vx * horizonMs;
  const y = pointer.y + pointer.vy * horizonMs;
  return x >= rect.left - marginPx && x <= rect.right + marginPx && y >= rect.top - marginPx && y <= rect.bottom + marginPx;
}

async function warmFetch(url: string, init: RequestInit = {}): Promise<void> {
  if (!shouldPrefetchMedia()) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(url, {
      ...init,
      cache: 'force-cache',
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!response.ok && response.status !== 206) throw new Error(`prefetch ${response.status}`);
    // Reading the body is required for it to enter the HTTP cache. fMP4 warmups
    // are intentionally tiny: init plus enough timeline-aligned segments for ~2s.
    await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

export async function prewarmFrontierVideoStream(stream?: FrontierVideoStream, fallbackUrl?: string): Promise<void> {
  if (!shouldPrefetchMedia()) return;
  if (stream?.kind === 'frontier-fmp4') {
    const firstVariant = [...stream.variants].sort((left, right) => left.bitrate - right.bitrate)[0];
    if (!firstVariant) return;
    const urls = [stream.initUrl];
    let duration = 0;
    for (const segment of firstVariant.segments) {
      urls.push(segment.url);
      duration += segment.duration;
      if (duration >= 2) break;
    }
    for (const url of urls) await warmFetch(url);
    return;
  }
  if (stream?.kind === 'hls') {
    await warmFetch(stream.manifestUrl);
    return;
  }
  const progressive = stream?.kind === 'progressive' ? stream.url : fallbackUrl;
  if (!progressive) return;
  try {
    const parsed = new URL(progressive, window.location.href);
    if (parsed.origin !== window.location.origin) return;
    await warmFetch(parsed.toString(), { headers: { Range: 'bytes=0-1048575' } });
  } catch {
    // Native metadata preload remains the fallback for arbitrary cross-origin video.
  }
}
