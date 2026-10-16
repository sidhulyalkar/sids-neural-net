'use client';

import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { frontierFlipDelta, frontierSpringTransform } from '@/lib/frontier/interaction/fluidPointer';
import { prefersReducedMotion } from '@/lib/frontier/media/capabilities';

const CARD_SELECTOR = '[data-frontier-fluid-card]';
const GPU_SELECTOR = '[data-frontier-gpu-id]';
const DURATION_MS = 460;
const FRAME_COUNT = 22;
const VIEWPORT_MARGIN = 640;

type Snapshot = Map<string, DOMRect>;

function cardKey(node: Element): string | undefined {
  return node.getAttribute('data-frontier-fluid-card') || undefined;
}

function isNearViewport(rect: DOMRect): boolean {
  return rect.bottom >= -VIEWPORT_MARGIN
    && rect.top <= window.innerHeight + VIEWPORT_MARGIN
    && rect.right >= -VIEWPORT_MARGIN
    && rect.left <= window.innerWidth + VIEWPORT_MARGIN;
}

function springKeyframes(first: DOMRect, last: DOMRect): Keyframe[] {
  const delta = frontierFlipDelta(first, last);
  const frames: Keyframe[] = [];
  for (let index = 0; index <= FRAME_COUNT; index += 1) {
    const offset = index / FRAME_COUNT;
    frames.push({
      offset,
      transformOrigin: 'top left',
      transform: frontierSpringTransform(delta, offset),
    });
  }
  return frames;
}

export function useSpatialFlip(containerRef: RefObject<HTMLElement | null>) {
  const first = useRef<Snapshot | undefined>(undefined);
  const animations = useRef(new Map<string, Animation>());
  const mediaFrame = useRef<number | undefined>(undefined);

  const stopMediaPulse = useCallback(() => {
    if (mediaFrame.current !== undefined) cancelAnimationFrame(mediaFrame.current);
    mediaFrame.current = undefined;
  }, []);

  const pulseGpuPlane = useCallback((root: HTMLElement) => {
    if (!root.querySelector(GPU_SELECTOR)) return;
    stopMediaPulse();
    const started = performance.now();
    const tick = (now: number) => {
      // The shared WebGL plane is viewport-fixed and normally invalidates on a
      // real viewport change. FLIP is a compositor transform, so explicitly
      // feed it frame ticks through its existing lightweight scroll invalidator
      // while cards move. No scroll position or preference signal is changed.
      window.dispatchEvent(new Event('scroll'));
      if (now - started <= DURATION_MS + 34) mediaFrame.current = requestAnimationFrame(tick);
      else mediaFrame.current = undefined;
    };
    mediaFrame.current = requestAnimationFrame(tick);
  }, [stopMediaPulse]);

  const capture = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const snapshot: Snapshot = new Map();
    for (const node of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
      const key = cardKey(node);
      if (!key) continue;
      const rect = node.getBoundingClientRect();
      if (isNearViewport(rect)) snapshot.set(key, rect);
    }
    for (const animation of animations.current.values()) animation.cancel();
    animations.current.clear();
    stopMediaPulse();
    first.current = snapshot;
  }, [containerRef, stopMediaPulse]);

  const play = useCallback(() => {
    const root = containerRef.current;
    const snapshot = first.current;
    first.current = undefined;
    if (!root || !snapshot?.size || prefersReducedMotion()) return;

    let animated = false;
    for (const node of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
      const key = cardKey(node);
      const before = key ? snapshot.get(key) : undefined;
      if (!key || !before) continue;
      const after = node.getBoundingClientRect();
      if (!isNearViewport(after)) continue;
      const dx = Math.abs(before.left - after.left);
      const dy = Math.abs(before.top - after.top);
      const dw = Math.abs(before.width - after.width);
      const dh = Math.abs(before.height - after.height);
      if (dx + dy + dw + dh < 0.5) continue;

      const animation = node.animate(springKeyframes(before, after), {
        duration: DURATION_MS,
        easing: 'linear',
        fill: 'both',
      });
      animated = true;
      animations.current.set(key, animation);
      animation.addEventListener('finish', () => {
        if (animations.current.get(key) === animation) {
          animation.cancel();
          animations.current.delete(key);
        }
      }, { once: true });
      animation.addEventListener('cancel', () => {
        if (animations.current.get(key) === animation) animations.current.delete(key);
      }, { once: true });
    }
    if (animated) pulseGpuPlane(root);
  }, [containerRef, pulseGpuPlane]);

  const cancel = useCallback(() => {
    for (const animation of animations.current.values()) animation.cancel();
    animations.current.clear();
    stopMediaPulse();
    first.current = undefined;
  }, [stopMediaPulse]);

  return { captureSpatialFlip: capture, playSpatialFlip: play, cancelSpatialFlip: cancel };
}
