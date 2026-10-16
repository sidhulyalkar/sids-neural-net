'use client';

import { useEffect, useRef } from 'react';
import { getFractalViewportGeometry } from '@/lib/home/fractalDendrite';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number };
type EchoShapeKind = 'triangle' | 'rhombus' | 'hexagon';

type EchoShape = {
  center: Vec2;
  kind: EchoShapeKind;
  size: number;
  rotation: number;
  tangent: number;
  radial: number;
  nested: boolean;
  matte: boolean;
  alpha: number;
};

const FERMAT_SPIRAL_STEP = 0.47;
const FERMAT_SPIRAL_ARMS = 3;
const TWO_PI = Math.PI * 2;

function seededRng(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function orientedPolygonVertices(
  center: Vec2,
  rx: number,
  ry: number,
  rotation: number,
  sides: number,
  startAngle = -Math.PI / 2
): Vec2[] {
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);
  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + (index / sides) * TWO_PI;
    const localX = Math.cos(angle) * rx;
    const localY = Math.sin(angle) * ry;
    return {
      x: center.x + localX * cosRotation - localY * sinRotation,
      y: center.y + localX * sinRotation + localY * cosRotation,
    };
  });
}

function scalePolygon(vertices: Vec2[], center: Vec2, scale: number): Vec2[] {
  return vertices.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
}

function tracePolygon(ctx: CanvasRenderingContext2D, vertices: Vec2[]) {
  if (vertices.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let index = 1; index < vertices.length; index += 1) ctx.lineTo(vertices[index].x, vertices[index].y);
  ctx.closePath();
}

function drawMatteHatch(
  ctx: CanvasRenderingContext2D,
  vertices: Vec2[],
  center: Vec2,
  radius: number,
  angle: number,
  alpha: number
) {
  ctx.save();
  tracePolygon(ctx, vertices);
  ctx.clip();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.strokeStyle = `rgba(218, 233, 231, ${alpha})`;
  ctx.lineWidth = 0.42;
  const spacing = clamp(radius * 0.16, 4.5, 10);
  const span = radius * 2.7;
  for (let offset = -span; offset <= span; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(-span, offset);
    ctx.lineTo(span, offset);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEchoShape(ctx: CanvasRenderingContext2D, shape: EchoShape) {
  const { center, kind, size, rotation, tangent, radial, nested, matte, alpha } = shape;
  const sides = kind === 'triangle' ? 3 : kind === 'hexagon' ? 6 : 4;
  const rx = kind === 'rhombus' ? size * 1.2 : kind === 'triangle' ? size * 1.03 : size * 0.98;
  const ry = kind === 'rhombus' ? size * 0.62 : kind === 'triangle' ? size * 0.86 : size * 0.9;
  const startAngle = kind === 'hexagon' ? -Math.PI / 2 : 0;
  const vertices = orientedPolygonVertices(center, rx, ry, rotation, sides, startAngle);

  tracePolygon(ctx, vertices);
  ctx.fillStyle = `rgba(211, 226, 224, ${0.008 + radial * 0.012})`;
  ctx.fill();
  if (matte) {
    drawMatteHatch(ctx, vertices, center, Math.max(rx, ry), tangent + Math.PI / 2, 0.018 + radial * 0.02);
  }
  tracePolygon(ctx, vertices);
  ctx.strokeStyle = `rgba(139, 210, 217, ${alpha})`;
  ctx.lineWidth = kind === 'hexagon' ? 0.58 : 0.48;
  ctx.lineJoin = 'miter';
  ctx.stroke();

  if (nested) {
    const inner = scalePolygon(vertices, center, kind === 'hexagon' ? 0.7 : 0.62);
    tracePolygon(ctx, inner);
    ctx.strokeStyle = `rgba(199, 225, 225, ${alpha * 0.62})`;
    ctx.lineWidth = 0.38;
    ctx.stroke();
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, bend: Vec2, alpha: number, width: number) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(bend.x, bend.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = `rgba(121, 196, 207, ${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

function buildProtectedRects(root: HTMLElement, padding = 15): Rect[] {
  const rootRect = root.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>('[data-navigation-clearance="protected"]')).map((element) => {
    const rect = element.getBoundingClientRect();
    const extra = element.getAttribute('href') === '/about' ? padding + 10 : padding;
    return {
      left: rect.left - rootRect.left - extra,
      top: rect.top - rootRect.top - extra,
      right: rect.right - rootRect.left + extra,
      bottom: rect.bottom - rootRect.top + extra,
    };
  });
}

function shapeIntersectsProtected(center: Vec2, radius: number, protectedRects: Rect[]): boolean {
  return protectedRects.some((rect) => {
    const closestX = clamp(center.x, rect.left, rect.right);
    const closestY = clamp(center.y, rect.top, rect.bottom);
    return Math.hypot(center.x - closestX, center.y - closestY) < radius;
  });
}

function pickShapeKind(rng: () => number): EchoShapeKind {
  const sample = rng();
  if (sample < 0.45) return 'rhombus';
  if (sample < 0.8) return 'triangle';
  return 'hexagon';
}

function fermatTangentAngle(theta: number, phase: number, radiusX: number, radiusY: number, thetaMax: number): number {
  const normalizedRadius = Math.sqrt(theta / thetaMax);
  const derivativeRadius = 1 / (2 * Math.sqrt(theta * thetaMax));
  const angle = theta + phase;
  const dx = radiusX * (derivativeRadius * Math.cos(angle) - normalizedRadius * Math.sin(angle));
  const dy = radiusY * (derivativeRadius * Math.sin(angle) + normalizedRadius * Math.cos(angle));
  return Math.atan2(dy, dx);
}

function buildFermatSpiralBand(
  rng: () => number,
  center: Vec2,
  radiusX: number,
  radiusY: number,
  countPerArm: number,
  baseSize: number,
  protectedRects: Rect[],
  viewport: { width: number; usableBottom: number },
  phaseOffset: number,
  arms = FERMAT_SPIRAL_ARMS
): EchoShape[][] {
  const shapeArms: EchoShape[][] = [];
  const thetaStart = 0.72;
  const thetaMax = thetaStart + Math.max(1, countPerArm - 1) * FERMAT_SPIRAL_STEP;
  const edgePadding = Math.max(16, baseSize * 0.55);

  for (let arm = 0; arm < arms; arm += 1) {
    const phase = phaseOffset + (arm / arms) * TWO_PI + (rng() - 0.5) * 0.045;
    const shapes: EchoShape[] = [];
    for (let index = 0; index < countPerArm; index += 1) {
      const theta = thetaStart + index * FERMAT_SPIRAL_STEP;
      const radial = Math.sqrt(theta / thetaMax);
      const angle = theta + phase;
      const point = {
        x: center.x + Math.cos(angle) * radiusX * radial,
        y: center.y + Math.sin(angle) * radiusY * radial,
      };
      const tangent = fermatTangentAngle(theta, phase, radiusX, radiusY, thetaMax);
      const kind = pickShapeKind(rng);
      const periodicPulse = index % 5 === 0 ? 1.16 : index % 3 === 0 ? 1.06 : 1;
      const size = baseSize * (0.56 + radial * 0.72) * periodicPulse * (0.92 + rng() * 0.16);
      const shapeRadius = size * (kind === 'rhombus' ? 1.32 : 1.12);

      if (
        point.x - shapeRadius < edgePadding ||
        point.x + shapeRadius > viewport.width - edgePadding ||
        point.y - shapeRadius < edgePadding ||
        point.y + shapeRadius > viewport.usableBottom - edgePadding ||
        shapeIntersectsProtected(point, shapeRadius + 4, protectedRects)
      ) {
        continue;
      }

      const rotationJitter = (rng() - 0.5) * 0.16;
      const shapeBias = kind === 'triangle' ? Math.PI / 18 : kind === 'hexagon' ? Math.PI / 24 : 0;
      shapes.push({
        center: point,
        kind,
        size,
        rotation: tangent + shapeBias + rotationJitter,
        tangent,
        radial,
        nested: kind === 'hexagon' || index % 4 === 0,
        matte: index % 3 === 0 || kind === 'rhombus',
        alpha: 0.07 + radial * 0.105 + (kind === 'hexagon' ? 0.025 : 0),
      });
    }
    shapeArms.push(shapes);
  }
  return shapeArms;
}

function drawFermatSpiralBand(ctx: CanvasRenderingContext2D, shapeArms: EchoShape[][]) {
  for (const shapes of shapeArms) {
    for (let index = 1; index < shapes.length; index += 1) {
      const previous = shapes[index - 1];
      const current = shapes[index];
      if (Math.hypot(current.center.x - previous.center.x, current.center.y - previous.center.y) > current.size * 4.8) {
        continue;
      }
      const bend = {
        x: (previous.center.x + current.center.x) * 0.5 + Math.cos(current.tangent) * current.size * 0.16,
        y: (previous.center.y + current.center.y) * 0.5 + Math.sin(current.tangent) * current.size * 0.16,
      };
      drawBridge(ctx, previous.center, current.center, bend, 0.035 + current.radial * 0.025, 0.28);
    }
  }
  for (const shape of shapeArms.flat().sort((a, b) => a.radial - b.radial)) drawEchoShape(ctx, shape);
}

function drawExpandedEchoNest(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  root: HTMLElement
) {
  const rng = seededRng(`echo-nest-v11-core-centered:${seed}:${width}x${height}`);
  const geometry = getFractalViewportGeometry({ width, height });
  const center = geometry.center;
  const compact = geometry.compact;
  const aspect = width / Math.max(height, 1);
  const radiusX = geometry.radiusX * (aspect > 2 ? 0.82 : compact ? 0.74 : 0.78);
  const radiusY = geometry.radiusY * (compact ? 0.78 : 0.84);
  const baseSize = Math.min(width, height) * (compact ? 0.033 : 0.036);
  const countPerArm = compact ? 14 : aspect > 2 ? 34 : 27;
  const protectedRects = buildProtectedRects(root, compact ? 10 : 16);
  const viewport = { width, usableBottom: geometry.usableBottom };

  const primary = buildFermatSpiralBand(
    rng,
    center,
    radiusX,
    radiusY,
    countPerArm,
    baseSize,
    protectedRects,
    viewport,
    -0.34,
    FERMAT_SPIRAL_ARMS
  );
  drawFermatSpiralBand(ctx, primary);

  const nucleus = buildFermatSpiralBand(
    rng,
    center,
    radiusX * 0.27,
    radiusY * 0.28,
    compact ? 7 : 11,
    baseSize * 0.68,
    protectedRects,
    viewport,
    0.82,
    2
  );
  drawFermatSpiralBand(ctx, nucleus);

  if (width >= 760) {
    const satelliteCenter = {
      x: center.x + radiusX * (aspect > 1.8 ? 0.82 : 0.72),
      y: center.y - radiusY * 0.82,
    };
    const satellite = buildFermatSpiralBand(
      rng,
      satelliteCenter,
      radiusX * 0.2,
      radiusY * 0.25,
      aspect > 1.8 ? 10 : 8,
      baseSize * 0.72,
      protectedRects,
      viewport,
      0.26,
      2
    );
    drawFermatSpiralBand(ctx, satellite);
  }
}

function lockCoreToTreeCenter(root: HTMLElement, width: number, height: number) {
  const core = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href="/about"]')).find(
    (link) => link.textContent?.trim().toLowerCase() === 'core'
  );
  if (!core) return;
  const center = getFractalViewportGeometry({ width, height }).center;
  core.style.left = `${center.x}px`;
  core.style.top = `${center.y}px`;
  core.style.transform = 'translate(-50%, -50%)';
  core.dataset.corePlacement = 'fixed-center-circle-v1';
  core.dataset.coreShape = 'circle';
  core.dataset.coreAnchor = 'tree-center';
  root.dataset.coreRouting = 'fixed-center-circle-v1';
  root.dataset.coreAnchorX = center.x.toFixed(2);
  root.dataset.coreAnchorY = center.y.toFixed(2);
}

export function FractalExperienceV3() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let lastSignature = '';
    let redirecting = false;

    const render = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      const morphology = root?.dataset.fractalMorphology;
      const seed = root?.dataset.fractalSeed;
      if (!root || !morphology || !seed || morphology === 'measuring') return;

      if (morphology === 'tectonic' && !redirecting) {
        redirecting = true;
        const entropy = seed.replace(/^force:[a-z-]+:/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 72) || 'echo';
        const url = new URL(window.location.href);
        url.searchParams.set('morph', 'echo-nest');
        url.searchParams.set('seed', entropy);
        window.location.replace(url.toString());
        return;
      }

      const rect = root.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || window.innerWidth));
      const height = Math.max(1, Math.round(rect.height || window.innerHeight));
      lockCoreToTreeCenter(root, width, height);

      const protectedSignature = Array.from(root.querySelectorAll<HTMLElement>('[data-navigation-clearance="protected"]'))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${Math.round(box.left)}:${Math.round(box.top)}:${Math.round(box.width)}:${Math.round(box.height)}`;
        })
        .join('|');
      const signature = `${morphology}:${seed}:${width}x${height}:${protectedSignature}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (morphology === 'echo-nest') {
        drawExpandedEchoNest(ctx, width, height, seed, root);
        canvas.dataset.echoNestLayout = 'fermat-core-centered-v2';
      } else {
        canvas.dataset.echoNestLayout = 'inactive';
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
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
      className="pointer-events-none fixed inset-0 z-[9]"
      aria-hidden="true"
      data-fractal-experience="v3"
      data-echo-nest-layout="pending"
    />
  );
}
