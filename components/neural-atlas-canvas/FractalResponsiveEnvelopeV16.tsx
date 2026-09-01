'use client';

import { useEffect } from 'react';
import {
  buildAdaptiveFractalTree,
  clamp,
  type FractalPath,
  type FractalTree,
  type Vec2,
} from '@/lib/home/fractalDendrite';
import {
  estimateResponsiveLabelHalfWidth,
  getResponsiveFractalEnvelope,
  mapPathToResponsiveEnvelope,
  responsiveNavigationPosition,
} from '@/lib/home/fractalResponsiveEnvelope';
import { VISUAL_LIMITS } from './visualLimits';

const DESTINATIONS = [
  { id: 'frontier', label: 'FRONTIER', compactLabel: 'FRONTIER' },
  { id: 'games', label: 'Game Network', compactLabel: 'Games' },
  { id: 'builds', label: 'Builds', compactLabel: 'Builds' },
  { id: 'systems', label: 'Deployed Systems', compactLabel: 'Systems' },
  { id: 'contact', label: 'Contact', compactLabel: 'Contact' },
  { id: 'visuals', label: 'Visual Cortex', compactLabel: 'Visuals' },
  { id: 'research', label: 'Research', compactLabel: 'Research' },
  { id: 'papers', label: 'Paper Archive', compactLabel: 'Papers' },
] as const;

const DESTINATION_IDS = DESTINATIONS.map((destination) => destination.id);

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

function polylineLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
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
  if (!points.length) return [];
  const oriented = [...points];
  if (distance(oriented[oriented.length - 1], center) < distance(oriented[0], center)) oriented.reverse();
  if (distance(oriented[0], center) > 1.5) oriented.unshift(center);
  else oriented[0] = center;
  return oriented;
}

function trimPrimaryToCoreEdge(points: Vec2[], center: Vec2, radius: number): Vec2[] {
  if (points.length < 2) return points;
  let outsideIndex = 1;
  while (outsideIndex < points.length && distance(points[outsideIndex], center) <= radius + 0.25) {
    outsideIndex += 1;
  }
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
  if (!rect || !points.length) return points;
  const endpoint = points[points.length - 1];
  const target = rectBoundaryToward(rect, endpoint);
  if (distance(endpoint, target) < 0.75) {
    const exact = [...points];
    exact[exact.length - 1] = target;
    return exact;
  }
  return [...points, target];
}

function drawPolyline(ctx: CanvasRenderingContext2D, points: readonly Vec2[]) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
}

function drawBackground(ctx: CanvasRenderingContext2D, tree: FractalTree, width: number, height: number) {
  const background = ctx.createRadialGradient(
    tree.center.x,
    tree.center.y,
    8,
    tree.center.x,
    tree.center.y,
    Math.max(width, height) * 0.74
  );
  background.addColorStop(0, '#050e15');
  background.addColorStop(0.3, '#03070c');
  background.addColorStop(0.7, '#020407');
  background.addColorStop(1, '#010204');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

function resolvedTree(root: HTMLElement, width: number, height: number): FractalTree | null {
  const seed = root.dataset.fractalSeed;
  const morphology = root.dataset.fractalMorphology;
  if (!seed || !morphology || morphology === 'measuring') return null;

  let tree = buildAdaptiveFractalTree({ width, height }, seed, DESTINATION_IDS);
  if (tree.morphology.id !== morphology) {
    const entropy = seed.replace(/^force:[a-z-]+:/, '') || 'responsive-v16';
    tree = buildAdaptiveFractalTree({ width, height }, `force:${morphology}:${entropy}`, DESTINATION_IDS);
  }
  return tree;
}

function identifyResponsiveIdentity(root: HTMLElement) {
  const heading = root.querySelector('h1');
  const identity = heading?.parentElement as HTMLElement | null;
  if (identity) identity.dataset.homeIdentityResponsive = 'v16';
}

function positionDestinations(root: HTMLElement, tree: FractalTree, width: number, height: number) {
  const dimensions = { width, height };
  const envelope = getResponsiveFractalEnvelope(dimensions);
  root.dataset.fractalNavigationDensity = envelope.compactNavigation ? 'compact-v16' : 'standard-v16';

  const links = DESTINATIONS.map((destination) => ({
    destination,
    endpoint: tree.endpoints.get(destination.id),
    link: root.querySelector<HTMLElement>(`[data-dendrite-destination="${destination.id}"]`),
  }));

  for (const item of links) {
    if (!item.link) continue;
    item.link.dataset.responsiveEnvelope = 'v16';
  }

  void root.offsetWidth;

  for (const { destination, endpoint, link } of links) {
    if (!endpoint || !link) continue;
    const label = envelope.compactNavigation ? destination.compactLabel : destination.label;
    const measured = link.getBoundingClientRect();
    const halfWidth = Math.max(
      estimateResponsiveLabelHalfWidth(label, envelope.compactNavigation),
      measured.width * 0.5
    );
    const halfHeight = Math.max(
      envelope.tinyViewport ? 13 : envelope.compactNavigation ? 14 : 17,
      measured.height * 0.5
    );
    const position = responsiveNavigationPosition(endpoint, tree, dimensions, halfWidth, halfHeight);
    link.style.setProperty('--fractal-v16-left', `${position.x.toFixed(2)}px`);
    link.style.setProperty('--fractal-v16-top', `${position.y.toFixed(2)}px`);
  }
}

function measuredDestinationRects(root: HTMLElement, rootRect: DOMRect): Map<string, Rect> {
  const result = new Map<string, Rect>();
  for (const destination of DESTINATIONS) {
    const link = root.querySelector<HTMLElement>(`[data-dendrite-destination="${destination.id}"]`);
    if (!link) continue;
    const rect = link.getBoundingClientRect();
    result.set(destination.id, {
      id: destination.id,
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      right: rect.right - rootRect.left,
      bottom: rect.bottom - rootRect.top,
    });
  }
  return result;
}

function lockCoreToResponsiveTree(rootRect: DOMRect, tree: FractalTree) {
  const coreDiameter = tree.compact ? 46 : 54;
  const left = `${(rootRect.left + tree.center.x).toFixed(2)}px`;
  const top = `${(rootRect.top + tree.center.y).toFixed(2)}px`;
  const size = `${coreDiameter}px`;

  const coreProxy = document.querySelector<HTMLElement>('[data-core-proxy="v13"]');
  const coreMask = document.querySelector<HTMLElement>('[data-core-clearance-mask="circle-edge-v13"]');
  for (const element of [coreProxy, coreMask]) {
    if (!element) continue;
    element.style.setProperty('--fractal-v16-core-left', left);
    element.style.setProperty('--fractal-v16-core-top', top);
    element.style.setProperty('--fractal-v16-core-size', size);
    element.dataset.responsiveCoreAuthority = 'v16';
  }
  return { center: tree.center, radius: coreDiameter * 0.5 };
}

function ensureResponsiveCanvas(root: HTMLElement, current: HTMLCanvasElement | null): HTMLCanvasElement {
  if (current?.parentElement === root) return current;
  current?.remove();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.fractalResponsiveCanvas = 'v16';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = '7';
  canvas.style.pointerEvents = 'none';
  root.appendChild(canvas);
  return canvas;
}

function drawStencil(
  ctx: CanvasRenderingContext2D,
  path: FractalPath,
  tree: FractalTree,
  width: number,
  height: number
) {
  const points = mapPathToResponsiveEnvelope(path.points, tree, { width, height });
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
  ctx.strokeStyle = `rgba(145, 198, 210, ${Math.min(0.28, path.alpha * 0.7)})`;
  ctx.lineWidth = Math.max(0.45, path.width * 0.78);
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

export function FractalResponsiveEnvelopeV16() {
  useEffect(() => {
    let animationFrame = 0;
    let settleFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let responsiveCanvas: HTMLCanvasElement | null = null;

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
      const dimensions = { width, height };
      const envelope = getResponsiveFractalEnvelope(dimensions);

      root.dataset.fractalShortViewport = envelope.shortViewport ? 'true' : 'false';
      identifyResponsiveIdentity(root);
      positionDestinations(root, tree, width, height);
      const core = lockCoreToResponsiveTree(rootRect, tree);

      const crispCanvas = root.querySelector<HTMLCanvasElement>('[data-fractal-crisp-topology="v13"]');
      if (crispCanvas) crispCanvas.style.opacity = '0';
      responsiveCanvas = ensureResponsiveCanvas(root, responsiveCanvas);

      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      responsiveCanvas.width = Math.max(1, Math.round(width * dpr));
      responsiveCanvas.height = Math.max(1, Math.round(height * dpr));
      responsiveCanvas.style.width = `${width}px`;
      responsiveCanvas.style.height = `${height}px`;
      const ctx = responsiveCanvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx, tree, width, height);

      for (const path of tree.paths.filter((candidate) => candidate.renderMode === 'stencil')) {
        drawStencil(ctx, path, tree, width, height);
      }

      for (const path of tree.paths.filter((candidate) => candidate.renderMode === 'pixel')) {
        const point = mapPathToResponsiveEnvelope(path.points.slice(0, 1), tree, dimensions)[0];
        if (!point) continue;
        const size = Math.max(1, path.width * 0.9);
        ctx.fillStyle = `rgba(160, 204, 214, ${Math.min(0.42, path.alpha * 0.8)})`;
        ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
      }

      const destinationRects = measuredDestinationRects(root, rootRect);
      const strokes = tree.paths
        .filter((path) => path.renderMode === 'stroke' && path.points.length >= 2)
        .sort((a, b) => a.depth - b.depth);
      const parentsByOwner = new Map<string, ParentPath[]>();
      const minBranchLength = envelope.tinyViewport ? 3.6 : envelope.compactNavigation ? 4.4 : 5.5;
      const maxAttachDistance = envelope.tinyViewport ? 6.5 : envelope.compactNavigation ? 8 : 11;

      for (const path of strokes) {
        const isPrimary = path.depth === 0 && path.ownerId !== '__ambient__';
        const mapped = mapPathToResponsiveEnvelope(path.points, tree, dimensions);
        let points: Vec2[];

        if (isPrimary) {
          const oriented = orientFromCore(mapped, tree.center);
          const ownerParents = parentsByOwner.get(path.ownerId) ?? [];
          ownerParents.push({ depth: 0, points: oriented });
          parentsByOwner.set(path.ownerId, ownerParents);
          points = trimPrimaryToCoreEdge(oriented, core.center, core.radius);
          points = appendExactLabelTerminal(points, destinationRects.get(path.ownerId));
        } else if (path.ownerId !== '__ambient__') {
          const repaired = snapBranchRoot(
            mapped,
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
          points = mapped;
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
        ctx.lineWidth = Math.max(isPrimary ? 1.2 : 0.34, path.width * widthScale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      root.dataset.fractalResponsiveEnvelope = 'v16';
      root.dataset.fractalResponsiveAuthority = 'v16';
      root.dataset.fractalBoundaryPolicy = 'elliptic-radial-cap-v16';
      root.dataset.fractalFieldScaleX = envelope.fieldScaleX.toFixed(4);
      root.dataset.fractalFieldScaleY = envelope.fieldScaleY.toFixed(4);
      root.dataset.fractalResponsiveViewport = `${width}x${height}`;
    };

    const schedule = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      animationFrame = requestAnimationFrame(() => {
        render();
        settleFrame = requestAnimationFrame(render);
      });
    };

    schedule();
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    if (typeof ResizeObserver !== 'undefined') {
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (root) {
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(root);
      }
    }
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      responsiveCanvas?.remove();
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      const crispCanvas = root?.querySelector<HTMLCanvasElement>('[data-fractal-crisp-topology="v13"]');
      if (crispCanvas) crispCanvas.style.opacity = '';
    };
  }, []);

  return (
    <style>{`
      [data-responsive-envelope="v16"] {
        left: var(--fractal-v16-left) !important;
        top: var(--fractal-v16-top) !important;
        transition-property: color, background-color, border-color, opacity, box-shadow, transform !important;
      }
      [data-responsive-core-authority="v16"] {
        left: var(--fractal-v16-core-left) !important;
        top: var(--fractal-v16-core-top) !important;
        width: var(--fractal-v16-core-size) !important;
        height: var(--fractal-v16-core-size) !important;
      }
      [data-fractal-navigation-density="compact-v16"] [data-dendrite-destination] > span:first-child {
        display: none !important;
      }
      [data-fractal-navigation-density="compact-v16"] [data-dendrite-destination] > span:last-child {
        display: inline !important;
      }
      [data-fractal-navigation-density="compact-v16"] [data-dendrite-destination] {
        padding: 0.32rem 0.5rem !important;
        font-size: 8.5px !important;
        letter-spacing: 0.1em !important;
      }
      @media (max-width: 359px) {
        [data-fractal-navigation-density="compact-v16"] [data-dendrite-destination] {
          padding: 0.28rem 0.42rem !important;
          font-size: 7.75px !important;
          letter-spacing: 0.085em !important;
        }
      }
      [data-fractal-short-viewport="true"] [data-home-identity-responsive="v16"] h1 {
        font-size: clamp(0.95rem, 3vw, 1.3rem) !important;
      }
      [data-fractal-short-viewport="true"] [data-home-identity-responsive="v16"] p {
        margin-top: 0.3rem !important;
        font-size: 7px !important;
      }
      @media (max-height: 500px) {
        [data-home-identity-responsive="v16"] {
          bottom: 0.5rem !important;
        }
        [data-home-identity-responsive="v16"] h1 {
          font-size: clamp(0.82rem, 2.6vw, 1.05rem) !important;
          letter-spacing: 0.12em !important;
        }
        [data-home-identity-responsive="v16"] p {
          display: none !important;
        }
      }
    `}</style>
  );
}
