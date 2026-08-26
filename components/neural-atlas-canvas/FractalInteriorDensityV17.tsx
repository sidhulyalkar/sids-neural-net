'use client';

import { useEffect } from 'react';
import { buildAdaptiveFractalTree, type FractalTree } from '@/lib/home/fractalDendrite';
import { buildResponsiveDensityPaths } from '@/lib/home/fractalResponsiveDensity';
import { VISUAL_LIMITS } from './visualLimits';

const DESTINATION_IDS = [
  'frontier',
  'games',
  'builds',
  'systems',
  'contact',
  'visuals',
  'research',
  'papers',
];

function resolvedTree(root: HTMLElement, width: number, height: number): FractalTree | null {
  const seed = root.dataset.fractalSeed;
  const morphology = root.dataset.fractalMorphology;
  if (!seed || !morphology || morphology === 'measuring') return null;

  let tree = buildAdaptiveFractalTree({ width, height }, seed, DESTINATION_IDS);
  if (tree.morphology.id !== morphology) {
    const entropy = seed.replace(/^force:[a-z-]+:/, '') || 'density-v17';
    tree = buildAdaptiveFractalTree({ width, height }, `force:${morphology}:${entropy}`, DESTINATION_IDS);
  }
  return tree;
}

function ensureCanvas(root: HTMLElement, current: HTMLCanvasElement | null): HTMLCanvasElement {
  if (current?.parentElement === root) return current;
  current?.remove();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.fractalInteriorDensity = 'v17';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = '8';
  canvas.style.pointerEvents = 'none';
  root.appendChild(canvas);
  return canvas;
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  depth: number
) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const midpoint = {
        x: (current.x + next.x) * 0.5,
        y: (current.y + next.y) * 0.5,
      };
      ctx.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.strokeStyle = depth === 1 ? 'rgba(125, 169, 181, 0.30)' : 'rgba(111, 145, 163, 0.20)';
  ctx.lineWidth = depth === 1 ? 0.78 : 0.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function FractalInteriorDensityV17() {
  useEffect(() => {
    let animationFrame = 0;
    let settleFrame = 0;
    let canvas: HTMLCanvasElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const render = () => {
      animationFrame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const width = Math.round(rect.width || window.innerWidth);
      const height = Math.round(rect.height || window.innerHeight);
      if (width <= 0 || height <= 0) return;

      const tree = resolvedTree(root, width, height);
      if (!tree) return;
      const seed = root.dataset.fractalSeed ?? 'density-v17';
      const paths = buildResponsiveDensityPaths(tree, { width, height }, seed);

      canvas = ensureCanvas(root, canvas);
      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const path of paths) drawPath(ctx, path.points, path.depth);

      root.dataset.fractalInteriorDensity = paths.length > 0 ? 'adaptive-canopy-v17' : 'native-density-v17';
      root.dataset.fractalInteriorPathCount = String(paths.length);
    };

    const schedule = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(render);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(render);
      });
    };

    const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
    if (root) {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(root);
      mutationObserver = new MutationObserver(schedule);
      mutationObserver.observe(root, {
        attributes: true,
        attributeFilter: ['data-fractal-seed', 'data-fractal-morphology'],
      });
    }

    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      canvas?.remove();
    };
  }, []);

  return null;
}
