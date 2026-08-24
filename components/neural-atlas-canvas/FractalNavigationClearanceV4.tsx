'use client';

import { useEffect, useRef } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

function drawClearanceMask(ctx: CanvasRenderingContext2D, root: HTMLElement, element: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const isCore = element.getAttribute('href') === '/about';
  const compact = rootRect.width < 620;
  const padding = isCore ? (compact ? 10 : 14) : compact ? 7 : 10;
  const left = rect.left - rootRect.left - padding;
  const top = rect.top - rootRect.top - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  ctx.save();
  ctx.shadowColor = 'rgba(1, 2, 4, 0.9)';
  ctx.shadowBlur = isCore ? 22 : 16;
  ctx.fillStyle = isCore ? 'rgba(1, 4, 7, 0.95)' : 'rgba(1, 3, 5, 0.9)';
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, isCore ? 4 : 3);
  ctx.fill();
  ctx.restore();
}

export function FractalNavigationClearanceV4() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const render = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (!root || root.dataset.fractalMorphology === 'measuring') return;
      const rect = root.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || window.innerWidth));
      const height = Math.max(1, Math.round(rect.height || window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const protectedElements = root.querySelectorAll<HTMLElement>('[data-navigation-clearance="protected"]');
      protectedElements.forEach((element) => drawClearanceMask(ctx, root, element));
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed', 'data-core-placement', 'style'],
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[16]"
      aria-hidden="true"
      data-fractal-navigation-clearance="v1"
    />
  );
}
