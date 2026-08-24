'use client';

import { useEffect, useRef } from 'react';
import {
  buildAdaptiveFractalTree,
  clamp,
  type FractalPath,
  type FractalTree,
  type Vec2,
} from '@/lib/home/fractalDendrite';
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
] as const;

const RETIRED = new Set(['aurora', 'mycelial', 'tectonic']);

type Rect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ParentPath = {
  depth: number;
  points: Vec2[];
};

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polylineLength(points: Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
  return total;
}

function normalize(dx: number, dy: number): Vec2 {
  const length = Math.max(1e-6, Math.hypot(dx, dy));
  return { x: dx / length, y: dy / length };
}

function nearestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): { point: Vec2; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (denominator < 1e-6) return { point: a, distance: distance(point, a) };
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator, 0, 1);
  const projected = { x: a.x + dx * t, y: a.y + dy * t };
  return { point: projected, distance: distance(point, projected) };
}

function snapBranchRoot(
  points: Vec2[],
  depth: number,
  parents: ParentPath[],
  maxAttachDistance: number
): Vec2[] | null {
  if (points.length < 2 || polylineLength(points) < 4) return null;
  const root = points[0];
  let bestPoint: Vec2 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const parent of parents) {
    if (parent.depth >= depth || parent.points.length < 2) continue;
    for (let index = 1; index < parent.points.length; index += 1) {
      const candidate = nearestPointOnSegment(root, parent.points[index - 1], parent.points[index]);
      if (candidate.distance < bestDistance) {
        bestDistance = candidate.distance;
        bestPoint = candidate.point;
      }
    }
  }

  if (!bestPoint || bestDistance > maxAttachDistance) return null;
  const repaired = [...points];
  repaired[0] = bestPoint;
  return repaired;
}

function orientFromCore(points: Vec2[], center: Vec2): Vec2[] {
  if (points.length === 0) return [];
  const oriented = [...points];
  if (distance(oriented[oriented.length - 1], center) < distance(oriented[0], center)) oriented.reverse();
  if (distance(oriented[0], center) > 1.5) oriented.unshift(center);
  else oriented[0] = center;
  return oriented;
}

function trimPrimaryToCoreEdge(points: Vec2[], center: Vec2, radius: number): Vec2[] {
  if (points.length < 2) return points;
  let outsideIndex = 1;
  while (outsideIndex < points.length && distance(points[outsideIndex], center) <= radius + 0.5) outsideIndex += 1;
  if (outsideIndex >= points.length) return [];

  const outside = points[outsideIndex];
  const direction = normalize(outside.x - center.x, outside.y - center.y);
  const edge = {
    x: center.x + direction.x * (radius + 0.35),
    y: center.y + direction.y * (radius + 0.35),
  };
  return [edge, ...points.slice(outsideIndex)];
}

function rectBoundaryToward(rect: Rect, from: Vec2): Vec2 {
  const center = { x: (rect.left + rect.right) * 0.5, y: (rect.top + rect.bottom) * 0.5 };
  const direction = normalize(from.x - center.x, from.y - center.y);
  const halfWidth = Math.max(1, (rect.right - rect.left) * 0.5);
  const halfHeight = Math.max(1, (rect.bottom - rect.top) * 0.5);
  const tx = Math.abs(direction.x) > 1e-6 ? halfWidth / Math.abs(direction.x) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(direction.y) > 1e-6 ? halfHeight / Math.abs(direction.y) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  return { x: center.x + direction.x * t, y: center.y + direction.y * t };
}

function appendExactLabelTerminal(points: Vec2[], rect: Rect | undefined): Vec2[] {
  if (!rect || points.length === 0) return points;
  const endpoint = points[points.length - 1];
  const target = rectBoundaryToward(rect, endpoint);
  if (distance(endpoint, target) < 0.75) {
    const exact = [...points];
    exact[exact.length - 1] = target;
    return exact;
  }
  return [...points, target];
}

function drawPolyline(ctx: CanvasRenderingContext2D, points: Vec2[]) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
}

function drawBackground(ctx: CanvasRenderingContext2D, tree: FractalTree, width: number, height: number) {
  const background = ctx.createRadialGradient(
    tree.center.x,
    tree.center.y,
    tree.morphology.id === 'halo' ? 2 : 8,
    tree.center.x,
    tree.center.y,
    Math.max(width, height) * 0.74
  );
  if (tree.morphology.id === 'halo') {
    background.addColorStop(0, '#010204');
    background.addColorStop(0.4, '#020408');
    background.addColorStop(0.74, '#050d14');
    background.addColorStop(1, '#010204');
  } else if (tree.morphology.id === 'pixel-ghost') {
    background.addColorStop(0, '#040b10');
    background.addColorStop(0.5, '#020508');
    background.addColorStop(1, '#010204');
  } else {
    background.addColorStop(0, '#050e15');
    background.addColorStop(0.3, '#03070c');
    background.addColorStop(0.7, '#020407');
    background.addColorStop(1, '#010204');
  }
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

function drawStencil(ctx: CanvasRenderingContext2D, path: FractalPath) {
  if (path.points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(path.points[0].x, path.points[0].y);
  for (let index = 1; index < path.points.length; index += 1) ctx.lineTo(path.points[index].x, path.points[index].y);
  ctx.closePath();
  ctx.strokeStyle = `rgba(145, 198, 210, ${Math.min(0.28, path.alpha * 0.7)})`;
  ctx.lineWidth = Math.max(0.45, path.width * 0.78);
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

function resolvedTree(root: HTMLElement, width: number, height: number): FractalTree | null {
  const seed = root.dataset.fractalSeed;
  const morphology = root.dataset.fractalMorphology;
  if (!seed || !morphology || morphology === 'measuring') return null;

  let tree = buildAdaptiveFractalTree({ width, height }, seed, [...DESTINATION_IDS]);
  if (tree.morphology.id !== morphology && !RETIRED.has(morphology)) {
    const entropy = seed.replace(/^force:[a-z-]+:/, '') || 'crisp';
    tree = buildAdaptiveFractalTree({ width, height }, `force:${morphology}:${entropy}`, [...DESTINATION_IDS]);
  }
  return tree;
}

function measuredDestinationRects(rootRect: DOMRect): Map<string, Rect> {
  const result = new Map<string, Rect>();
  for (const id of DESTINATION_IDS) {
    const link = document.querySelector<HTMLElement>(`[data-dendrite-destination="${id}"]`);
    if (!link) continue;
    const rect = link.getBoundingClientRect();
    result.set(id, {
      id,
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      right: rect.right - rootRect.left,
      bottom: rect.bottom - rootRect.top,
    });
  }
  return result;
}

export function FractalCrispTopologyV13() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreMaskRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const coreMask = coreMaskRef.current;
    if (!canvas || !coreMask) return;

    let animationFrame = 0;
    let hiddenBaseCanvas: HTMLCanvasElement | null = null;
    let previousBaseOpacity = '';

    const render = () => {
      animationFrame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const width = Math.round(rootRect.width || window.innerWidth);
      const height = Math.round(rootRect.height || window.innerHeight);
      if (width <= 0 || height <= 0) return;

      const tree = resolvedTree(root, width, height);
      if (!tree) return;

      const baseCanvas = root.querySelector<HTMLCanvasElement>('canvas');
      if (baseCanvas && baseCanvas !== hiddenBaseCanvas) {
        if (hiddenBaseCanvas) hiddenBaseCanvas.style.opacity = previousBaseOpacity;
        hiddenBaseCanvas = baseCanvas;
        previousBaseOpacity = baseCanvas.style.opacity;
        baseCanvas.style.opacity = '0';
        baseCanvas.dataset.supersededByCrispTopology = 'v13';
      }

      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx, tree, width, height);

      const destinationRects = measuredDestinationRects(rootRect);
      const coreLink = document.querySelector<HTMLElement>('[data-core-shape="circle"]');
      const coreRect = coreLink?.getBoundingClientRect();
      const coreCenter = coreRect
        ? { x: coreRect.left - rootRect.left + coreRect.width * 0.5, y: coreRect.top - rootRect.top + coreRect.height * 0.5 }
        : tree.center;
      const coreRadius = coreRect ? Math.min(coreRect.width, coreRect.height) * 0.5 : tree.compact ? 23 : 27;

      coreMask.style.display = 'block';
      coreMask.style.left = `${rootRect.left + coreCenter.x}px`;
      coreMask.style.top = `${rootRect.top + coreCenter.y}px`;
      coreMask.style.width = `${coreRadius * 2 + 2}px`;
      coreMask.style.height = `${coreRadius * 2 + 2}px`;

      const stencils = tree.paths.filter((path) => path.renderMode === 'stencil');
      for (const path of stencils) drawStencil(ctx, path);

      const pixels = tree.paths.filter((path) => path.renderMode === 'pixel');
      for (const path of pixels) {
        const point = path.points[0];
        if (!point) continue;
        const size = Math.max(1, path.width * 0.9);
        ctx.fillStyle = `rgba(160, 204, 214, ${Math.min(0.42, path.alpha * 0.8)})`;
        ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
      }

      const strokes = tree.paths
        .filter((path) => path.renderMode === 'stroke' && path.points.length >= 2)
        .sort((a, b) => a.depth - b.depth);
      const parentsByOwner = new Map<string, ParentPath[]>();
      const minBranchLength = tree.compact ? 4.5 : 6;
      const maxAttachDistance = tree.compact ? 8 : 13;

      for (const path of strokes) {
        const isPrimary = path.depth === 0 && path.ownerId !== '__ambient__';
        let points: Vec2[];

        if (isPrimary) {
          const oriented = orientFromCore(path.points, tree.center);
          const ownerParents = parentsByOwner.get(path.ownerId) ?? [];
          ownerParents.push({ depth: 0, points: oriented });
          parentsByOwner.set(path.ownerId, ownerParents);

          points = trimPrimaryToCoreEdge(oriented, coreCenter, coreRadius);
          points = appendExactLabelTerminal(points, destinationRects.get(path.ownerId));
        } else if (path.ownerId !== '__ambient__') {
          const repaired = snapBranchRoot(
            path.points,
            path.depth,
            parentsByOwner.get(path.ownerId) ?? [],
            maxAttachDistance
          );
          if (!repaired || polylineLength(repaired) < minBranchLength) continue;
          points = repaired;
          const ownerParents = parentsByOwner.get(path.ownerId) ?? [];
          ownerParents.push({ depth: path.depth, points: repaired });
          parentsByOwner.set(path.ownerId, ownerParents);
        } else {
          points = path.points;
          if (polylineLength(points) < minBranchLength) continue;
        }

        if (points.length < 2) continue;
        const primaryAlpha = Math.min(0.84, Math.max(0.68, path.alpha * 0.96));
        const branchAlpha = Math.min(0.48, Math.max(0.12, path.alpha * 0.9));
        const alpha = isPrimary ? primaryAlpha : branchAlpha;
        const widthScale = isPrimary ? 0.94 : path.depth >= 3 ? 0.82 : 0.9;

        drawPolyline(ctx, points);
        ctx.strokeStyle = isPrimary
          ? `rgba(205, 226, 223, ${alpha})`
          : path.depth <= 2
            ? `rgba(146, 188, 202, ${alpha})`
            : `rgba(127, 146, 179, ${alpha})`;
        ctx.lineWidth = Math.max(isPrimary ? 1.25 : 0.36, path.width * widthScale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      root.dataset.primaryRouting = 'core-and-label-edge-v13';
      root.dataset.topologyRepair = 'snap-prune-v13';
      root.dataset.coreClearance = 'circle-edge-v13';
      root.dataset.renderFidelity = 'crisp-no-glow-v13';
    };

    const schedule = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(render);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (hiddenBaseCanvas) {
        hiddenBaseCanvas.style.opacity = previousBaseOpacity;
        delete hiddenBaseCanvas.dataset.supersededByCrispTopology;
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[6]"
        aria-hidden="true"
        data-fractal-crisp-topology="v13"
      />
      <div
        ref={coreMaskRef}
        className="pointer-events-none fixed z-[19] hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#010204]"
        aria-hidden="true"
        data-core-clearance-mask="circle-edge-v13"
      />
    </>
  );
}
