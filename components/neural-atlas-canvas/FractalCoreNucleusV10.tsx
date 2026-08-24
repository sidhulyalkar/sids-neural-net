'use client';

import { useLayoutEffect, useRef } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };

type NucleusGeometry = {
  compact: boolean;
  center: Vec2;
  radiusX: number;
  radiusY: number;
  usableBottom: number;
};

const TWO_PI = Math.PI * 2;
const PRIMARY_ANGLE_OFFSET = -Math.PI / 2;
const DESTINATION_COUNT = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function nucleusGeometry(width: number, height: number): NucleusGeometry {
  const aspect = width / Math.max(height, 1);
  const compact = width < 620;
  const short = height < 650;
  const portrait = aspect < 0.86;
  const ultrawide = aspect > 1.85;
  const edgeMargin = clamp(Math.min(width, height) * 0.038, compact ? 18 : 28, 64);
  const titleBand = clamp(height * (short ? 0.12 : compact ? 0.15 : 0.14), 84, 138);
  const usableBottom = Math.max(edgeMargin + 220, height - titleBand);
  const usableHeight = Math.max(240, usableBottom - edgeMargin);
  const center = {
    x: width * 0.5,
    y: edgeMargin + usableHeight * (portrait ? 0.48 : short ? 0.46 : 0.47),
  };
  const horizontalReach = Math.max(120, width * 0.5 - edgeMargin);
  const verticalReach = Math.max(
    120,
    Math.min(center.y - edgeMargin, usableBottom - center.y - edgeMargin * 0.35)
  );

  return {
    compact,
    center,
    radiusX: horizontalReach * (compact ? 0.82 : ultrawide ? 0.94 : 0.91),
    radiusY: verticalReach * (portrait ? 0.96 : short ? 0.88 : 0.93),
    usableBottom,
  };
}

function ellipsePoint(center: Vec2, angle: number, radiusX: number, radiusY: number, scale: number): Vec2 {
  return {
    x: center.x + Math.cos(angle) * radiusX * scale,
    y: center.y + Math.sin(angle) * radiusY * scale,
  };
}

function drawAngularTrunk(
  ctx: CanvasRenderingContext2D,
  start: Vec2,
  end: Vec2,
  rng: () => number,
  index: number
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const tangent = { x: dx / length, y: dy / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const side = index % 2 === 0 ? 1 : -1;
  const bendA = {
    x: start.x + dx * 0.34 + normal.x * side * length * (0.018 + rng() * 0.02),
    y: start.y + dy * 0.34 + normal.y * side * length * (0.018 + rng() * 0.02),
  };
  const bendB = {
    x: start.x + dx * 0.68 - normal.x * side * length * (0.012 + rng() * 0.018),
    y: start.y + dy * 0.68 - normal.y * side * length * (0.012 + rng() * 0.018),
  };

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(bendA.x, bendA.y);
  ctx.lineTo(bendB.x, bendB.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = 'rgba(203, 228, 226, 0.58)';
  ctx.lineWidth = 1.05;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

function polygonVertices(center: Vec2, rx: number, ry: number, rotation: number, sides: number): Vec2[] {
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index / sides) * TWO_PI;
    const localX = Math.cos(angle) * rx;
    const localY = Math.sin(angle) * ry;
    return {
      x: center.x + localX * cosRotation - localY * sinRotation,
      y: center.y + localX * sinRotation + localY * cosRotation,
    };
  });
}

function drawInnerFermatOrbit(
  ctx: CanvasRenderingContext2D,
  geometry: NucleusGeometry,
  seed: string,
  moatRadius: number
) {
  const rng = seededRng(`core-fermat-orbit:${seed}`);
  const count = geometry.compact ? 10 : 18;
  const orbitRadiusX = Math.max(moatRadius * 2.25, geometry.radiusX * 0.16);
  const orbitRadiusY = Math.max(moatRadius * 1.8, geometry.radiusY * 0.2);
  const thetaStep = 0.67;

  for (let index = 0; index < count; index += 1) {
    const t = (index + 1) / count;
    const theta = 0.72 + index * thetaStep;
    const radial = 0.42 + Math.sqrt(t) * 0.58;
    const angle = theta - 0.46;
    const point = {
      x: geometry.center.x + Math.cos(angle) * orbitRadiusX * radial,
      y: geometry.center.y + Math.sin(angle) * orbitRadiusY * radial,
    };
    const derivativeRadius = 0.29 / Math.max(Math.sqrt(t), 0.2);
    const dx = orbitRadiusX * (derivativeRadius * Math.cos(angle) - radial * Math.sin(angle));
    const dy = orbitRadiusY * (derivativeRadius * Math.sin(angle) + radial * Math.cos(angle));
    const tangent = Math.atan2(dy, dx);
    const kind = index % 7 === 0 ? 'hexagon' : index % 3 === 0 ? 'triangle' : 'rhombus';
    const sides = kind === 'triangle' ? 3 : kind === 'hexagon' ? 6 : 4;
    const size = (geometry.compact ? 8 : 11) * (0.78 + radial * 0.42) * (index % 5 === 0 ? 1.16 : 1);
    const vertices = polygonVertices(
      point,
      kind === 'rhombus' ? size * 1.18 : size,
      kind === 'rhombus' ? size * 0.62 : size * 0.88,
      tangent + (rng() - 0.5) * 0.08,
      sides
    );

    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let vertex = 1; vertex < vertices.length; vertex += 1) ctx.lineTo(vertices[vertex].x, vertices[vertex].y);
    ctx.closePath();
    ctx.strokeStyle = `rgba(137, 207, 215, ${0.065 + radial * 0.045})`;
    ctx.lineWidth = 0.42;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }
}

function drawNucleusOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  geometry: NucleusGeometry,
  seed: string
) {
  const moatRadius = clamp(Math.min(width, height) * (geometry.compact ? 0.058 : 0.07), 38, 76);
  const gradient = ctx.createRadialGradient(
    geometry.center.x,
    geometry.center.y,
    0,
    geometry.center.x,
    geometry.center.y,
    moatRadius
  );
  gradient.addColorStop(0, 'rgba(1, 4, 7, 0.98)');
  gradient.addColorStop(0.5, 'rgba(1, 4, 7, 0.88)');
  gradient.addColorStop(0.78, 'rgba(1, 4, 7, 0.42)');
  gradient.addColorStop(1, 'rgba(1, 4, 7, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(geometry.center.x, geometry.center.y, moatRadius, 0, TWO_PI);
  ctx.fill();

  drawInnerFermatOrbit(ctx, geometry, seed, moatRadius);

  const rng = seededRng(`core-root-trunks:${seed}:${width}x${height}`);
  const innerScale = geometry.compact ? 0.34 : 0.4;
  for (let index = 0; index < DESTINATION_COUNT; index += 1) {
    const angle = PRIMARY_ANGLE_OFFSET + (index / DESTINATION_COUNT) * TWO_PI;
    const endpoint = ellipsePoint(geometry.center, angle, geometry.radiusX, geometry.radiusY, innerScale);
    drawAngularTrunk(ctx, geometry.center, endpoint, rng, index);
  }
}

function enforceCoreNucleus(root: HTMLElement, geometry: NucleusGeometry) {
  if (root.dataset.fractalMorphology !== 'echo-nest') return;
  const core = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href="/about"]')).find(
    (link) => link.textContent?.trim().toLowerCase() === 'core'
  );
  if (!core) return;

  const expectedLeft = `${geometry.center.x}px`;
  const expectedTop = `${geometry.center.y}px`;
  if (core.style.left !== expectedLeft) core.style.left = expectedLeft;
  if (core.style.top !== expectedTop) core.style.top = expectedTop;
  if (core.style.transform !== 'translate(-50%, -50%)') core.style.transform = 'translate(-50%, -50%)';
  core.style.background = 'rgba(2, 8, 12, 0.97)';
  core.style.boxShadow = '0 0 0 1px rgba(220,242,242,0.12), 0 0 0 12px rgba(1,4,7,0.8), 0 0 34px rgba(1,4,7,0.94)';
  core.dataset.corePlacement = 'central-nucleus-v2';
  core.dataset.coreAnchor = 'tree-center';
  core.setAttribute('aria-label', 'Open core / about');

  root.dataset.coreRouting = 'central-nucleus-v2';
  root.dataset.coreAnchorX = geometry.center.x.toFixed(2);
  root.dataset.coreAnchorY = geometry.center.y.toFixed(2);
}

export function FractalCoreNucleusV10() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let enforcing = false;

    const render = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (!root || root.dataset.fractalMorphology !== 'echo-nest') {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const rect = root.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || window.innerWidth));
      const height = Math.max(1, Math.round(rect.height || window.innerHeight));
      const geometry = nucleusGeometry(width, height);
      enforcing = true;
      enforceCoreNucleus(root, geometry);
      enforcing = false;

      const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawNucleusOverlay(ctx, width, height, geometry, root.dataset.fractalSeed ?? 'echo');
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      if (enforcing) return;
      if (
        mutations.some((mutation) =>
          mutation.type === 'childList' ||
          (mutation.type === 'attributes' &&
            ['style', 'data-fractal-morphology', 'data-fractal-seed'].includes(mutation.attributeName ?? ''))
        )
      ) {
        schedule();
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'data-fractal-morphology', 'data-fractal-seed'],
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
      className="pointer-events-none fixed inset-0 z-[11]"
      aria-hidden="true"
      data-fractal-core-nucleus="v2"
    />
  );
}
