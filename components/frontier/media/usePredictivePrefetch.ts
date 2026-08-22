'use client';

import { useEffect } from 'react';
import {
  frontierPrefetchTargets,
  predictPointerIntersection,
  predictViewportIntersection,
  scheduleFrontierPrefetch,
  shouldPrefetchMedia,
} from '@/lib/frontier/media/streamPrefetcher';
import { resetFrontierScrollVelocity, setFrontierScrollVelocity } from '@/lib/frontier/vector/interactionPace';

const HORIZON_MS = 300;
const COOLDOWN_MS = 24_000;
const MAX_WARMS_PER_PASS = 2;

type PointerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  at: number;
};

export function usePredictivePrefetch(): void {
  useEffect(() => {
    if (!shouldPrefetchMedia()) return;

    const warmedAt = new Map<string, number>();
    let pointer: PointerState = { x: -10_000, y: -10_000, vx: 0, vy: 0, at: performance.now() };
    let scrollY = window.scrollY;
    let scrollAt = performance.now();
    let scrollVelocity = 0;
    let raf: number | undefined;

    const evaluate = () => {
      raf = undefined;
      if (!shouldPrefetchMedia()) return;
      const now = performance.now();
      let warmed = 0;

      for (const target of frontierPrefetchTargets()) {
        if (warmed >= MAX_WARMS_PER_PASS) break;
        if ((warmedAt.get(target.id) ?? -Infinity) + COOLDOWN_MS > now) continue;

        const rect = target.node.getBoundingClientRect();
        const predictedByScroll = Math.abs(scrollVelocity) > 0.08 && predictViewportIntersection(
          rect,
          scrollVelocity,
          window.innerHeight,
          HORIZON_MS
        );
        const predictedByPointer = Math.hypot(pointer.vx, pointer.vy) > 0.02 && predictPointerIntersection(
          rect,
          pointer,
          HORIZON_MS
        );

        const currentlyNear = rect.bottom >= -120 && rect.top <= window.innerHeight + 120;
        if (!predictedByScroll && !predictedByPointer && !currentlyNear) continue;

        warmedAt.set(target.id, now);
        warmed += 1;
        scheduleFrontierPrefetch(target.warm);
      }
    };

    const invalidate = () => {
      if (raf !== undefined) return;
      raf = window.requestAnimationFrame(evaluate);
    };

    const onPointerMove = (event: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(8, now - pointer.at);
      const instantVx = (event.clientX - pointer.x) / dt;
      const instantVy = (event.clientY - pointer.y) / dt;
      pointer = {
        x: event.clientX,
        y: event.clientY,
        vx: pointer.x < -1000 ? 0 : pointer.vx * 0.55 + instantVx * 0.45,
        vy: pointer.y < -1000 ? 0 : pointer.vy * 0.55 + instantVy * 0.45,
        at: now,
      };
      invalidate();
    };

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(8, now - scrollAt);
      const currentY = window.scrollY;
      const instant = (currentY - scrollY) / dt;
      scrollVelocity = scrollVelocity * 0.58 + instant * 0.42;
      setFrontierScrollVelocity(scrollVelocity, now);
      scrollY = currentY;
      scrollAt = now;
      invalidate();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') invalidate();
      else resetFrontierScrollVelocity();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    invalidate();

    return () => {
      if (raf !== undefined) window.cancelAnimationFrame(raf);
      resetFrontierScrollVelocity();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
