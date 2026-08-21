'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  stepWaterfallParticle,
  waterfallOpacity,
  type WaterfallParticleState,
} from '@/lib/frontier/waterfallPhysics';

type Particle = WaterfallParticleState & {
  node: HTMLSpanElement;
};

type Options = {
  collisionRef?: RefObject<HTMLElement | null>;
  durationMs?: number;
};

function numberStyle(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function copyTextStyle(from: CSSStyleDeclaration, to: CSSStyleDeclaration) {
  to.fontFamily = from.fontFamily;
  to.fontSize = from.fontSize;
  to.fontWeight = from.fontWeight;
  to.fontStyle = from.fontStyle;
  to.fontStretch = from.fontStretch;
  to.fontVariant = from.fontVariant;
  to.fontKerning = from.fontKerning;
  to.fontFeatureSettings = from.fontFeatureSettings;
  to.letterSpacing = from.letterSpacing;
  to.lineHeight = from.lineHeight;
  to.textTransform = from.textTransform;
  to.color = from.color;
}

function measureCharacters(input: HTMLInputElement, text: string) {
  const style = window.getComputedStyle(input);
  const inputRect = input.getBoundingClientRect();
  const fontSize = numberStyle(style.fontSize, 13);
  const lineHeight = style.lineHeight === 'normal'
    ? fontSize * 1.2
    : numberStyle(style.lineHeight, fontSize * 1.2);
  const mirror = document.createElement('div');
  const textNode = document.createTextNode(text);

  mirror.setAttribute('aria-hidden', 'true');
  Object.assign(mirror.style, {
    position: 'fixed',
    left: `${inputRect.left + numberStyle(style.borderLeftWidth) + numberStyle(style.paddingLeft) - input.scrollLeft}px`,
    top: `${inputRect.top + (inputRect.height - lineHeight) / 2}px`,
    margin: '0',
    padding: '0',
    border: '0',
    whiteSpace: 'pre',
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  copyTextStyle(style, mirror.style);
  mirror.appendChild(textNode);
  document.body.appendChild(mirror);

  const characters: Array<{ char: string; rect: DOMRect }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    const rect = range.getBoundingClientRect();

    // Only animate characters that were actually visible inside the single-line input.
    if (rect.right <= inputRect.left || rect.left >= inputRect.right) continue;
    characters.push({ char: text[index], rect });
  }

  mirror.remove();
  return { characters, inputRect, style };
}

export function useWaterfallText(
  inputRef: RefObject<HTMLInputElement | null>,
  { collisionRef, durationMs = 1_500 }: Options = {}
) {
  const [active, setActive] = useState(false);
  const rafRef = useRef<number | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (rafRef.current !== undefined) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    overlayRef.current?.remove();
    overlayRef.current = undefined;
    particlesRef.current = [];
    if (mountedRef.current) setActive(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== undefined) window.cancelAnimationFrame(rafRef.current);
      overlayRef.current?.remove();
      overlayRef.current = undefined;
      particlesRef.current = [];
    };
  }, []);

  const launch = useCallback((value?: string) => {
    const input = inputRef.current;
    const text = value ?? input?.value ?? '';
    if (!input || !text || !input.isConnected) return false;

    cleanup();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

    const { characters, inputRect, style } = measureCharacters(input, text);
    if (!characters.length) return false;

    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '160',
      contain: 'strict',
    });
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    const centerX = inputRect.left + inputRect.width / 2;
    particlesRef.current = characters.flatMap(({ char, rect }, index) => {
      if (/\s/.test(char)) return [];
      const node = document.createElement('span');
      node.textContent = char;
      node.setAttribute('aria-hidden', 'true');
      Object.assign(node.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        margin: '0',
        padding: '0',
        border: '0',
        whiteSpace: 'pre',
        pointerEvents: 'none',
        transformOrigin: '50% 50%',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        textRendering: 'geometricPrecision',
      });
      copyTextStyle(style, node.style);
      overlay.appendChild(node);

      const normalized = inputRect.width > 0
        ? ((rect.left + rect.width / 2) - centerX) / (inputRect.width / 2)
        : 0;
      const seed = ((index * 37) % 17) / 17 - 0.5;
      return [{
        node,
        x: rect.left,
        y: rect.top,
        vx: normalized * 95 + seed * 84,
        vy: -78 - ((index * 29) % 78),
        rotation: 0,
        angularVelocity: seed * 410 + normalized * 95,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      } satisfies Particle];
    });

    const dockTop = collisionRef?.current?.getBoundingClientRect().top;
    const floorY = Number.isFinite(dockTop)
      ? Math.min(window.innerHeight - 4, Math.max(inputRect.bottom + 64, (dockTop as number) - 8))
      : window.innerHeight - 6;
    const bounds = { minX: 2, maxX: window.innerWidth - 2, floorY };
    const startedAt = performance.now();
    let previous = startedAt;
    setActive(true);

    const frame = (now: number) => {
      const age = now - startedAt;
      const dt = (now - previous) / 1_000;
      previous = now;
      const opacity = waterfallOpacity(age, durationMs);

      particlesRef.current = particlesRef.current.map((particle) => {
        const next = stepWaterfallParticle(particle, dt, bounds) as Particle;
        next.node = particle.node;
        next.node.style.opacity = String(opacity);
        next.node.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) rotate(${next.rotation}deg)`;
        return next;
      });

      if (age >= durationMs || !particlesRef.current.length) {
        cleanup();
        return;
      }
      rafRef.current = window.requestAnimationFrame(frame);
    };

    // Paint the particles at their measured coordinates before physics advances.
    for (const particle of particlesRef.current) {
      particle.node.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)`;
    }
    rafRef.current = window.requestAnimationFrame(frame);
    return true;
  }, [cleanup, collisionRef, durationMs, inputRef]);

  return {
    launchWaterfall: launch,
    cancelWaterfall: cleanup,
    waterfallActive: active,
  };
}
