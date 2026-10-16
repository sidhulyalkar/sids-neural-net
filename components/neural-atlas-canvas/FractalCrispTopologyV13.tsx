'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
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
const CORE_TEXT_STYLE: CSSProperties = {
  fontFamily:
    '"Roboto Mono", "IBM Plex Mono", "Berkeley Mono", "Aptos Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", var(--font-geist-mono), monospace',
  fontFeatureSettings: '"zero" 1, "ss02" 1, "calt" 1',
  textRendering: 'geometricPrecision',
};

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

type SavedCoreAttributes = {
  placement: string | null;
  shape: string | null;
  clearance: string | null;
  gestureTarget: string | null;
  opacity: string;
  pointerEvents: string;
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
  while (outsideIndex < points.length && distance(points[outsideIndex], center) <= radius + 0.25) outsideIndex += 1;
  if (outsideIndex >= points.length) return [];

  const outside = points[outsideIndex];
  const direction = normalize(outside.x - center.x, outside.y - center.y);
  const edge = {
    x: center.x + direction.x * (radius + 0.2),
    y: center.y + direction.y * (radius + 0.2),
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

function setOrRemoveAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

export function FractalCrispTopologyV13() {
  const coreMaskRef = useRef<HTMLDivElement>(null);
  const coreProxyRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const coreMask = coreMaskRef.current;
    const coreProxy = coreProxyRef.current;
    if (!coreMask || !coreProxy) return;

    let animationFrame = 0;
    let crispCanvas: HTMLCanvasElement | null = null;
    let hiddenBaseCanvas: HTMLCanvasElement | null = null;
    let previousBaseOpacity = '';
    let hiddenOriginalCore: HTMLAnchorElement | null = null;
    let savedCoreAttributes: SavedCoreAttributes | null = null;

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

      if (!crispCanvas || crispCanvas.parentElement !== root) {
        crispCanvas?.remove();
        crispCanvas = document.createElement('canvas');
        crispCanvas.setAttribute('aria-hidden', 'true');
        crispCanvas.dataset.fractalCrispTopology = 'v13';
        crispCanvas.style.position = 'absolute';
        crispCanvas.style.inset = '0';
        crispCanvas.style.zIndex = '6';
        crispCanvas.style.pointerEvents = 'none';
        root.appendChild(crispCanvas);
      }

      const originalCore = root.querySelector<HTMLAnchorElement>('a[href="/about"][data-core-shape="circle"]');
      if (originalCore && originalCore !== hiddenOriginalCore) {
        if (hiddenOriginalCore && savedCoreAttributes) {
          hiddenOriginalCore.style.opacity = savedCoreAttributes.opacity;
          hiddenOriginalCore.style.pointerEvents = savedCoreAttributes.pointerEvents;
          setOrRemoveAttribute(hiddenOriginalCore, 'data-core-placement', savedCoreAttributes.placement);
          setOrRemoveAttribute(hiddenOriginalCore, 'data-core-shape', savedCoreAttributes.shape);
          setOrRemoveAttribute(hiddenOriginalCore, 'data-navigation-clearance', savedCoreAttributes.clearance);
          setOrRemoveAttribute(hiddenOriginalCore, 'data-gesture-target', savedCoreAttributes.gestureTarget);
        }
        hiddenOriginalCore = originalCore;
        savedCoreAttributes = {
          placement: originalCore.getAttribute('data-core-placement'),
          shape: originalCore.getAttribute('data-core-shape'),
          clearance: originalCore.getAttribute('data-navigation-clearance'),
          gestureTarget: originalCore.getAttribute('data-gesture-target'),
          opacity: originalCore.style.opacity,
          pointerEvents: originalCore.style.pointerEvents,
        };
        originalCore.style.opacity = '0';
        originalCore.style.pointerEvents = 'none';
        originalCore.removeAttribute('data-core-placement');
        originalCore.removeAttribute('data-core-shape');
        originalCore.removeAttribute('data-navigation-clearance');
        originalCore.removeAttribute('data-gesture-target');
        originalCore.dataset.supersededByCoreProxy = 'v13';
      }

      const coreRect = hiddenOriginalCore?.getBoundingClientRect();
      const coreCenter = coreRect
        ? {
            x: coreRect.left - rootRect.left + coreRect.width * 0.5,
            y: coreRect.top - rootRect.top + coreRect.height * 0.5,
          }
        : tree.center;
      const coreDiameter = coreRect ? Math.min(coreRect.width, coreRect.height) : tree.compact ? 46 : 54;
      const coreRadius = coreDiameter * 0.5;

      coreMask.style.display = 'block';
      coreMask.style.left = `${rootRect.left + coreCenter.x}px`;
      coreMask.style.top = `${rootRect.top + coreCenter.y}px`;
      coreMask.style.width = `${coreDiameter}px`;
      coreMask.style.height = `${coreDiameter}px`;

      coreProxy.style.opacity = '1';
      coreProxy.style.left = `${rootRect.left + coreCenter.x}px`;
      coreProxy.style.top = `${rootRect.top + coreCenter.y}px`;
      coreProxy.style.width = `${coreDiameter}px`;
      coreProxy.style.height = `${coreDiameter}px`;

      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      crispCanvas.width = Math.max(1, Math.round(width * dpr));
      crispCanvas.height = Math.max(1, Math.round(height * dpr));
      crispCanvas.style.width = `${width}px`;
      crispCanvas.style.height = `${height}px`;
      const ctx = crispCanvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx, tree, width, height);

      const destinationRects = measuredDestinationRects(rootRect);
      for (const path of tree.paths.filter((candidate) => candidate.renderMode === 'stencil')) drawStencil(ctx, path);

      for (const path of tree.paths.filter((candidate) => candidate.renderMode === 'pixel')) {
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
      crispCanvas?.remove();
      if (hiddenBaseCanvas) {
        hiddenBaseCanvas.style.opacity = previousBaseOpacity;
        delete hiddenBaseCanvas.dataset.supersededByCrispTopology;
      }
      if (hiddenOriginalCore && savedCoreAttributes) {
        hiddenOriginalCore.style.opacity = savedCoreAttributes.opacity;
        hiddenOriginalCore.style.pointerEvents = savedCoreAttributes.pointerEvents;
        setOrRemoveAttribute(hiddenOriginalCore, 'data-core-placement', savedCoreAttributes.placement);
        setOrRemoveAttribute(hiddenOriginalCore, 'data-core-shape', savedCoreAttributes.shape);
        setOrRemoveAttribute(hiddenOriginalCore, 'data-navigation-clearance', savedCoreAttributes.clearance);
        setOrRemoveAttribute(hiddenOriginalCore, 'data-gesture-target', savedCoreAttributes.gestureTarget);
        delete hiddenOriginalCore.dataset.supersededByCoreProxy;
      }
    };
  }, []);

  return (
    <>
      <div
        ref={coreMaskRef}
        className="pointer-events-none fixed z-[19] hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#010204]"
        aria-hidden="true"
        data-core-clearance-mask="circle-edge-v13"
      />
      <Link
        ref={coreProxyRef}
        href="/about"
        data-navigation-clearance="protected"
        data-gesture-target
        data-core-placement="fixed-center-circle-v1"
        data-core-shape="circle"
        data-core-anchor="tree-center"
        data-core-proxy="v13"
        aria-label="Open core / about"
        className="fixed z-[30] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/28 bg-[#02080c] p-0 text-[9px] uppercase tracking-[0.14em] text-white/88 opacity-0 shadow-[0_0_0_5px_rgba(1,2,4,0.9),0_0_18px_rgba(95,222,238,0.055)] transition-all hover:border-cyan-300/42 hover:bg-[#041016] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/60 sm:text-[10px] lg:text-[11px]"
        style={CORE_TEXT_STYLE}
      >
        Core
      </Link>
    </>
  );
}
