'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
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

const MAX_GEOMETRY_CACHE = 768;
const geometryCache = new Map<string, Geometry>();

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
  root.style.containIntrinsicSize = `auto ${geometry.height}px`;
  root.dataset.frontierGeometry = 'locked';
  root.dataset.frontierGeometryHeight = geometry.height.toFixed(2);
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

function nearViewport(rect: DOMRect): boolean {
  const margin = window.innerHeight * 2;
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

/**
 * Compact cards are measured once for each real width/density geometry and the
 * result becomes both their masonry span and their exact virtualization
 * intrinsic height. Height-only changes never trigger a compact remeasurement,
 * so async media decode cannot start a ResizeObserver feedback loop.
 *
 * Expanded cards are intentionally different: they are visible user-intent
 * surfaces and may grow as focal evidence appears, so their grid span stays
 * live until collapse restores the cached compact geometry.
 */
export function useDeterministicMasonry({ itemId, expanded, rootRef, measureRef }: Options): void {
  const pendingKey = useRef<string | undefined>(undefined);
  const pendingObserver = useRef<ResizeObserver | undefined>(undefined);
  const pendingFrame = useRef<number | undefined>(undefined);
  const pendingRestore = useRef<(() => void) | undefined>(undefined);
  const observedWidth = useRef<number | undefined>(undefined);

  const cancelPending = useCallback(() => {
    pendingObserver.current?.disconnect();
    pendingObserver.current = undefined;
    if (pendingFrame.current !== undefined) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = undefined;
    pendingRestore.current?.();
    pendingRestore.current = undefined;
    pendingKey.current = undefined;
  }, []);

  const lockCompactGeometry = useCallback((forceLayout = false) => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure || root.dataset.fluidExpanded === 'true') return;

    const rect = root.getBoundingClientRect();
    if (rect.width < 2) return;
    const density = densityKey(root);
    const key = geometryKey(itemId, rect.width, density);
    const cached = cachedGeometry(key);
    if (cached) {
      cancelPending();
      applyGeometry(root, cached);
      return;
    }
    if (!forceLayout && !nearViewport(rect)) return;
    if (pendingKey.current === key) return;

    cancelPending();
    pendingKey.current = key;
    const previousInlineVisibility = root.style.contentVisibility;
    const restoreVisibility = () => {
      if (rootRef.current === root && root.dataset.fluidExpanded !== 'true') {
        root.style.contentVisibility = previousInlineVisibility;
      }
    };
    pendingRestore.current = restoreVisibility;
    if (getComputedStyle(root).contentVisibility !== 'visible') root.style.contentVisibility = 'visible';

    let complete = false;
    const finish = () => {
      if (complete) return;
      const currentRoot = rootRef.current;
      const currentMeasure = measureRef.current;
      if (!currentRoot || !currentMeasure || currentRoot.dataset.fluidExpanded === 'true') return;
      const geometry = readGeometry(currentRoot, currentMeasure);
      if (!geometry) return;
      complete = true;
      // Responsive layout may change between scheduling and this measurement.
      // Always cache under the geometry we actually measured, never the width
      // that happened to exist when the observer was armed.
      const measuredKey = geometryKey(itemId, geometry.width, geometry.density);
      rememberGeometry(measuredKey, geometry);
      applyGeometry(currentRoot, geometry);
      pendingObserver.current?.disconnect();
      pendingObserver.current = undefined;
      pendingKey.current = undefined;
      pendingFrame.current = undefined;
      pendingRestore.current = undefined;
      restoreVisibility();
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => finish());
      pendingObserver.current = observer;
      observer.observe(measure);
    }
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = requestAnimationFrame(finish);
    });
  }, [cancelPending, itemId, measureRef, rootRef]);

  useLayoutEffect(() => {
    if (expanded) return;
    lockCompactGeometry(false);
  }, [expanded, lockCompactGeometry]);

  useEffect(() => {
    if (expanded || typeof IntersectionObserver === 'undefined') return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      lockCompactGeometry(true);
      observer.disconnect();
    }, { rootMargin: '200% 0px 200% 0px', threshold: 0 });
    observer.observe(root);
    return () => observer.disconnect();
  }, [expanded, lockCompactGeometry, rootRef]);

  useEffect(() => {
    if (expanded || typeof ResizeObserver === 'undefined') return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = widthBucket(entry?.contentRect.width ?? root.getBoundingClientRect().width);
      if (width < 2 || observedWidth.current === width) return;
      observedWidth.current = width;
      lockCompactGeometry(false);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [expanded, lockCompactGeometry, rootRef]);

  useLayoutEffect(() => {
    if (!expanded) return;
    cancelPending();
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
  }, [cancelPending, expanded, measureRef, rootRef]);

  useEffect(() => cancelPending, [cancelPending]);
}

export function frontierMasonryGeometryCacheSize(): number {
  return geometryCache.size;
}
