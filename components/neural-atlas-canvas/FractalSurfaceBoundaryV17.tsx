'use client';

import { useEffect } from 'react';

const BOUNDARY_POLICY = 'circular-navigation-clip-v17';
const DECORATIVE_BOUNDARY = 'navigation-circle-v17';
const DECORATIVE_CANVAS_SELECTOR =
  '[data-fractal-surface-enhancer="v2"], [data-fractal-experience="v3"]';

function decorativeCanvases(): HTMLCanvasElement[] {
  return Array.from(document.querySelectorAll<HTMLCanvasElement>(DECORATIVE_CANVAS_SELECTOR));
}

function clearBoundary(canvas: HTMLCanvasElement) {
  delete canvas.dataset.fractalDecorativeBoundary;
  delete canvas.dataset.fractalDecorativeClipRadius;
  delete canvas.dataset.fractalDecorativeClipCenter;
  canvas.style.clipPath = '';
  canvas.style.removeProperty('-webkit-clip-path');
}

function applyCanvasBoundary(canvas: HTMLCanvasElement, radius: number, centerX: number, centerY: number) {
  const clip = `circle(${radius.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px)`;
  canvas.style.clipPath = clip;
  canvas.style.setProperty('-webkit-clip-path', clip);
  canvas.dataset.fractalDecorativeBoundary = DECORATIVE_BOUNDARY;
  canvas.dataset.fractalDecorativeClipRadius = radius.toFixed(2);
  canvas.dataset.fractalDecorativeClipCenter = `${centerX.toFixed(2)},${centerY.toFixed(2)}`;
}

export function FractalSurfaceBoundaryV17() {
  useEffect(() => {
    let frame = 0;

    const applyBoundary = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      const canvases = decorativeCanvases();
      if (!root || !canvases.length) return;

      const rect = root.getBoundingClientRect();
      const width = Math.round(rect.width || window.innerWidth);
      const height = Math.round(rect.height || window.innerHeight);
      const expectedViewport = `${width}x${height}`;
      const radius = Number(root.dataset.fractalDecorativeClipRadius);
      const centerX = Number(root.dataset.coreAnchorX);
      const centerY = Number(root.dataset.coreAnchorY);
      const ready =
        root.dataset.fractalBoundaryPolicy === BOUNDARY_POLICY &&
        root.dataset.fractalResponsiveViewport === expectedViewport &&
        Number.isFinite(radius) &&
        radius > 1 &&
        Number.isFinite(centerX) &&
        Number.isFinite(centerY);

      if (!ready) {
        for (const canvas of canvases) clearBoundary(canvas);
        delete root.dataset.fractalDecorativeBoundary;
        return;
      }

      for (const canvas of canvases) applyCanvasBoundary(canvas, radius, centerX, centerY);
      root.dataset.fractalDecorativeBoundary = DECORATIVE_BOUNDARY;
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyBoundary);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-fractal-morphology',
        'data-fractal-seed',
        'data-fractal-boundary-policy',
        'data-fractal-decorative-clip-radius',
        'data-fractal-responsive-viewport',
        'data-core-anchor-x',
        'data-core-anchor-y',
      ],
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      for (const canvas of decorativeCanvases()) clearBoundary(canvas);
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (root) delete root.dataset.fractalDecorativeBoundary;
    };
  }, []);

  return (
    <style>{`
      [data-fractal-surface-enhancer="v2"],
      [data-fractal-experience="v3"] {
        opacity: 0 !important;
      }
      [data-fractal-surface-enhancer="v2"][data-fractal-decorative-boundary="navigation-circle-v17"],
      [data-fractal-experience="v3"][data-fractal-decorative-boundary="navigation-circle-v17"] {
        opacity: 1 !important;
      }
    `}</style>
  );
}
