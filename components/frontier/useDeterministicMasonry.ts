'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { frontierMasonrySpan } from '@/lib/frontier/presentation/mediaForward';

type Geometry = {
  height: number;
  span: number;
  width: number;
  density: string;
};

type Options = {
  itemId: string;
  expanded: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
};

type PendingCompactMeasurement = {
  token: symbol;
  itemId: string;
  root: HTMLElement;
  measure: HTMLElement;
  retries: number;
};

type ResolvedCompactMeasurement = PendingCompactMeasurement & {
  geometry: Geometry;
  key: string;
};

const MAX_GEOMETRY_CACHE = 768;
const MAX_MEASUREMENT_RETRIES = 2;
const geometryCache = new Map<string, Geometry>();
const pendingCompactMeasurements = new Map<symbol, PendingCompactMeasurement>();
let compactFlushQueued = false;

function cssNumber(node: HTMLElement, property: string, fallback: number): number {
  const parsed = Number.parseFloat(getComputedStyle(node).getPropertyValue(property));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function widthBucket(width: number): number {
  return Math.max(1, Math.round(width * 2) / 2);
}

function densityKey(node: HTMLElement): string {
  return node.closest<HTMLElement>('[data-density]')?.dataset.density || 'balanced';
}

function geometryKey(itemId: string, width: number, density: string): string {
  return `${itemId}|${density}|${widthBucket(width)}`;
}

function rememberGeometry(key: string, geometry: Geometry): void {
  geometryCache.delete(key);
  geometryCache.set(key, geometry);
  while (geometryCache.size > MAX_GEOMETRY_CACHE) {
    const oldest = geometryCache.keys().next().value;
    if (!oldest) break;
    geometryCache.delete(oldest);
  }
}

function cachedGeometry(key: string): Geometry | undefined {
  const geometry = geometryCache.get(key);
  if (!geometry) return undefined;
  geometryCache.delete(key);
  geometryCache.set(key, geometry);
  return geometry;
}

function applyGeometry(root: HTMLElement, geometry: Geometry): void {
  root.style.setProperty('--frontier-masonry-span', String(geometry.span));
  root.style.setProperty('--frontier-card-intrinsic-height', `${geometry.height}px`);

  // `contain-intrinsic-size: auto <length>` is intentionally NOT used here.
  // Chromium's `auto` form remembers a previously rendered subtree size and
  // may swap that remembered value in as content-visibility skips/reveals the
  // card. That makes the browser, rather than the geometry cache, an authority
  // over scroll extent. Lock only the block axis to our measured compact size;
  // the masonry/grid continues to own inline width.
  root.style.setProperty('contain-intrinsic-inline-size', 'none');
  root.style.setProperty('contain-intrinsic-block-size', `${geometry.height}px`);
  root.dataset.frontierGeometry = 'locked';
  root.dataset.frontierGeometryHeight = geometry.height.toFixed(2);
}

function unlockGeometry(root: HTMLElement): void {
  delete root.dataset.frontierGeometry;
  delete root.dataset.frontierGeometryHeight;
  root.style.removeProperty('contain-intrinsic-size');
  root.style.removeProperty('contain-intrinsic-inline-size');
  root.style.removeProperty('contain-intrinsic-block-size');
}

function readGeometry(root: HTMLElement, measure: HTMLElement): Geometry | undefined {
  const width = root.getBoundingClientRect().width;
  if (width < 2) return undefined;
  const height = Math.max(measure.scrollHeight, measure.getBoundingClientRect().height);
  if (!Number.isFinite(height) || height < 2) return undefined;
  const rowHeight = cssNumber(root, '--frontier-masonry-row-height', 8);
  const rowGap = cssNumber(root, '--frontier-masonry-row-gap', 10);
  return {
    width: widthBucket(width),
    height: Math.ceil(height * 4) / 4,
    span: frontierMasonrySpan(height, rowHeight, rowGap),
    density: densityKey(root),
  };
}

function scheduleCompactFlush(): void {
  if (compactFlushQueued) return;
  compactFlushQueued = true;
  const flush = () => {
    compactFlushQueued = false;
    const entries = [...pendingCompactMeasurements.values()];
    pendingCompactMeasurements.clear();
    if (!entries.length) return;

    // Strict two-phase batch: every layout/computed-style read is completed
    // before any card receives span/intrinsic-size writes. This prevents the
    // classic read -> write -> read forced-reflow staircase across a masonry
    // commit while still locking all compact geometry before first paint.
    const resolved: ResolvedCompactMeasurement[] = [];
    const retry: PendingCompactMeasurement[] = [];

    for (const entry of entries) {
      const { root, measure } = entry;
      if (!root.isConnected || !measure.isConnected || root.dataset.fluidExpanded === 'true') continue;

      const rect = root.getBoundingClientRect();
      if (rect.width < 2) {
        if (entry.retries < MAX_MEASUREMENT_RETRIES) retry.push({ ...entry, retries: entry.retries + 1 });
        continue;
      }

      const density = densityKey(root);
      const key = geometryKey(entry.itemId, rect.width, density);
      const cached = cachedGeometry(key);
      if (cached) {
        resolved.push({ ...entry, geometry: cached, key });
        continue;
      }

      const geometry = readGeometry(root, measure);
      if (!geometry) {
        if (entry.retries < MAX_MEASUREMENT_RETRIES) retry.push({ ...entry, retries: entry.retries + 1 });
        continue;
      }
      resolved.push({
        ...entry,
        geometry,
        key: geometryKey(entry.itemId, geometry.width, geometry.density),
      });
    }

    for (const entry of resolved) {
      if (!entry.root.isConnected || entry.root.dataset.fluidExpanded === 'true') continue;
      rememberGeometry(entry.key, entry.geometry);
      applyGeometry(entry.root, entry.geometry);
    }

    if (retry.length && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        for (const entry of retry) {
          if (!entry.root.isConnected || entry.root.dataset.fluidExpanded === 'true') continue;
          pendingCompactMeasurements.set(entry.token, entry);
        }
        if (pendingCompactMeasurements.size) scheduleCompactFlush();
      });
    }
  };

  if (typeof queueMicrotask === 'function') queueMicrotask(flush);
  else void Promise.resolve().then(flush);
}

function enqueueCompactMeasurement(entry: PendingCompactMeasurement): void {
  pendingCompactMeasurements.set(entry.token, entry);
  scheduleCompactFlush();
}

function cancelCompactMeasurement(token: symbol): void {
  pendingCompactMeasurements.delete(token);
}

/**
 * Compact cards participate in one exact pre-virtualization geometry batch.
 * Until that batch commits, CSS keeps the card paint/layout-visible rather than
 * substituting a guessed contain-intrinsic-size. Once locked, the measured
 * height becomes both its masonry span and fixed block-axis virtualization
 * intrinsic height. Async image decode is therefore unable to renegotiate card
 * geometry, and Chromium's remembered-size mode cannot rewrite scroll extent.
 */
export function useDeterministicMasonry({ itemId, expanded, rootRef, measureRef }: Options): void {
  // A state initializer gives this hook one stable opaque token for its lifetime
  // without reading a ref during render. The token is operational identity only
  // and never participates in visual output.
  const [measurementToken] = useState(() => Symbol(itemId));
  const observedWidth = useRef<number | undefined>(undefined);

  const queueCompactGeometry = useCallback((invalidate = false) => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure || root.dataset.fluidExpanded === 'true') return;
    if (invalidate) unlockGeometry(root);
    enqueueCompactMeasurement({ token: measurementToken, itemId, root, measure, retries: 0 });
  }, [itemId, measureRef, measurementToken, rootRef]);

  useLayoutEffect(() => {
    if (expanded) return;
    queueCompactGeometry(false);
    return () => cancelCompactMeasurement(measurementToken);
  }, [expanded, measurementToken, queueCompactGeometry]);

  useEffect(() => {
    if (expanded || typeof ResizeObserver === 'undefined') return;
    const root = rootRef.current;
    if (!root) return;
    observedWidth.current = widthBucket(root.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      const width = widthBucket(entry?.contentRect.width ?? root.getBoundingClientRect().width);
      if (width < 2 || observedWidth.current === width) return;
      observedWidth.current = width;
      queueCompactGeometry(true);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [expanded, queueCompactGeometry, rootRef]);

  useLayoutEffect(() => {
    if (!expanded) return;
    cancelCompactMeasurement(measurementToken);
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;

    const syncExpandedSpan = () => {
      const height = Math.max(measure.scrollHeight, measure.getBoundingClientRect().height);
      if (!Number.isFinite(height) || height < 2) return;
      const rowHeight = cssNumber(root, '--frontier-masonry-row-height', 8);
      const rowGap = cssNumber(root, '--frontier-masonry-row-gap', 10);
      root.style.setProperty('--frontier-masonry-span', String(frontierMasonrySpan(height, rowHeight, rowGap)));
    };

    syncExpandedSpan();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncExpandedSpan);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [expanded, measurementToken, measureRef, rootRef]);

  useEffect(() => () => cancelCompactMeasurement(measurementToken), [measurementToken]);
}

export function frontierMasonryGeometryCacheSize(): number {
  return geometryCache.size;
}
