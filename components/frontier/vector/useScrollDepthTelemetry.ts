'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { emitFrontierSemanticTelemetry } from '@/lib/frontier/vector/telemetryEngine';

const DEPTH_THRESHOLDS = [0.5, 0.82] as const;

/**
 * Samples the reading surface at three horizontal points instead of measuring
 * every card during scroll. `elementFromPoint()` lets the browser's existing
 * hit-test structure identify the visible item, keeping the telemetry path O(1)
 * per sampled column and away from layout-heavy feed scans.
 */
export function useScrollDepthTelemetry(items: FrontierItem[], enabled: boolean): void {
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const emittedDepth = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled || !items.length) return;
    let raf: number | undefined;

    const sample = () => {
      raf = undefined;
      if (document.visibilityState !== 'visible') return;
      const y = Math.round(window.innerHeight * 0.62);
      const xPositions = window.innerWidth < 720
        ? [Math.round(window.innerWidth * 0.5)]
        : [0.22, 0.5, 0.78].map((fraction) => Math.round(window.innerWidth * fraction));

      for (const x of xPositions) {
        const hit = document.elementFromPoint(x, y) as HTMLElement | null;
        const wrapper = hit?.closest<HTMLElement>('[data-frontier-item-id]');
        if (!wrapper) continue;
        const id = wrapper.dataset.frontierItemId;
        if (!id) continue;
        const item = itemMap.get(id);
        if (!item) continue;
        const rect = wrapper.getBoundingClientRect();
        if (rect.height <= 0) continue;
        const depth = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
        const previous = emittedDepth.current.get(id) ?? 0;
        const threshold = [...DEPTH_THRESHOLDS].reverse().find((value) => depth >= value && previous < value);
        if (!threshold) continue;
        emittedDepth.current.set(id, threshold);
        emitFrontierSemanticTelemetry({ kind: 'visibility-depth', item, depth: threshold });
      }
    };

    const onScroll = () => {
      if (raf !== undefined) return;
      raf = window.requestAnimationFrame(sample);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const initial = window.requestAnimationFrame(sample);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(initial);
      if (raf !== undefined) window.cancelAnimationFrame(raf);
    };
  }, [enabled, itemMap, items.length]);
}
