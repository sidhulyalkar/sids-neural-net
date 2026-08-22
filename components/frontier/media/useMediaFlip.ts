'use client';

import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { prefersReducedMotion } from '@/lib/frontier/media/capabilities';

type FlipSnapshot = {
  rect: DOMRect;
  radius: string;
};

export function useMediaFlip(ref: RefObject<HTMLElement | null>) {
  const first = useRef<FlipSnapshot | undefined>(undefined);
  const animation = useRef<Animation | undefined>(undefined);

  const capture = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    animation.current?.cancel();
    const style = window.getComputedStyle(node);
    first.current = {
      rect: node.getBoundingClientRect(),
      radius: style.borderRadius,
    };
  }, [ref]);

  const play = useCallback((durationMs = 420) => {
    const node = ref.current;
    const snapshot = first.current;
    if (!node || !snapshot) return;
    if (prefersReducedMotion()) {
      first.current = undefined;
      return;
    }

    const last = node.getBoundingClientRect();
    const dx = snapshot.rect.left - last.left;
    const dy = snapshot.rect.top - last.top;
    const sx = snapshot.rect.width / Math.max(1, last.width);
    const sy = snapshot.rect.height / Math.max(1, last.height);
    const lastRadius = window.getComputedStyle(node).borderRadius;

    animation.current?.cancel();
    const nextAnimation = node.animate([
      {
        transformOrigin: 'top left',
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
        borderRadius: snapshot.radius,
      },
      {
        transformOrigin: 'top left',
        transform: 'translate3d(0, 0, 0) scale(1, 1)',
        borderRadius: lastRadius,
      },
    ], {
      duration: durationMs,
      easing: 'cubic-bezier(.2,.78,.2,1)',
      fill: 'both',
    });
    animation.current = nextAnimation;

    nextAnimation.addEventListener('finish', () => {
      if (animation.current === nextAnimation) {
        nextAnimation.cancel();
        animation.current = undefined;
        first.current = undefined;
      }
    }, { once: true });
  }, [ref]);

  const cancel = useCallback(() => {
    animation.current?.cancel();
    animation.current = undefined;
    first.current = undefined;
  }, []);

  return { captureFlip: capture, playFlip: play, cancelFlip: cancel };
}
