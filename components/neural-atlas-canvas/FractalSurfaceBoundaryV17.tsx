'use client';

import { useEffect } from 'react';

const BOUNDARY_POLICY = 'circular-navigation-clip-v17';
const SURFACE_BOUNDARY = 'navigation-circle-v17';

function clearBoundary(canvas: HTMLCanvasElement) {
  delete canvas.dataset.fractalSurfaceBoundary;
  delete canvas.dataset.fractalSurfaceClipRadius;
  delete canvas.dataset.fractalSurfaceClipCenter;
  canvas.style.clipPath = '';
  canvas.style.removeProperty('-webkit-clip-path');
}

export function FractalSurfaceBoundaryV17() {
  useEffect(() => {
    let frame = 0;

    const applyBoundary = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      const canvas = document.querySelector<HTMLCanvasElement>('[data-fractal-surface-enhancer="v2"]');
      if (!root || !canvas) return;

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
        clearBoundary(canvas);
        return;
      }

      const clip = `circle(${radius.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px)`;
      canvas.style.clipPath = clip;
      canvas.style.setProperty('-webkit-clip-path', clip);
      canvas.dataset.fractalSurfaceBoundary = SURFACE_BOUNDARY;
      canvas.dataset.fractalSurfaceClipRadius = radius.toFixed(2);
      canvas.dataset.fractalSurfaceClipCenter = `${centerX.toFixed(2)},${centerY.toFixed(2)}`;
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
      const canvas = document.querySelector<HTMLCanvasElement>('[data-fractal-surface-enhancer="v2"]');
      if (canvas) clearBoundary(canvas);
    };
  }, []);

  return (
    <style>{`
      [data-fractal-surface-enhancer="v2"] {
        opacity: 0 !important;
      }
      [data-fractal-surface-enhancer="v2"][data-fractal-surface-boundary="navigation-circle-v17"] {
        opacity: 1 !important;
      }
    `}</style>
  );
}
