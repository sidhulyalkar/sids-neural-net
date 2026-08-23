'use client';

import { useEffect, useRef } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };
type Morphology = 'tectonic' | 'mycelial' | 'pixel-ghost' | 'spiraloid';

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

function distanceSquared(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function drawTectonic(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const usableBottom = height - Math.min(150, height * 0.16);
  const baseline: Vec2[] = [];
  const steps = width / height > 2 ? 44 : 34;
  let y = usableBottom * (0.43 + rng() * 0.08);
  let slope = 0;

  for (let index = 0; index <= steps; index += 1) {
    slope = slope * 0.62 + (rng() - 0.5) * usableBottom * 0.022;
    y = Math.max(54, Math.min(usableBottom - 46, y + slope));
    baseline.push({ x: 24 + ((width - 48) * index) / steps, y });
  }

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(baseline[0].x, baseline[0].y);
  for (let index = 1; index < baseline.length; index += 1) ctx.lineTo(baseline[index].x, baseline[index].y);
  ctx.strokeStyle = 'rgba(169, 216, 221, 0.28)';
  ctx.lineWidth = 0.72;
  ctx.stroke();

  const fracture = (start: Vec2, angle: number, length: number, depth: number) => {
    if (depth > 4 || length < 8) return;
    const joints = 3 + Math.max(0, 3 - depth);
    const points: Vec2[] = [start];
    let point = start;
    let heading = angle;
    for (let joint = 0; joint < joints; joint += 1) {
      heading += (rng() - 0.5) * (0.26 + depth * 0.11);
      const segment = length / joints;
      point = {
        x: Math.max(18, Math.min(width - 18, point.x + Math.cos(heading) * segment)),
        y: Math.max(28, Math.min(usableBottom - 24, point.y + Math.sin(heading) * segment)),
      };
      points.push(point);
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    ctx.strokeStyle = `rgba(126, 177, 194, ${Math.max(0.09, 0.26 - depth * 0.04)})`;
    ctx.lineWidth = Math.max(0.32, 0.82 - depth * 0.12);
    ctx.stroke();

    const end = points[points.length - 1];
    const turn = Math.PI / 2 + (rng() - 0.5) * 0.5;
    if (rng() > 0.16) fracture(end, heading + turn, length * (0.48 + rng() * 0.12), depth + 1);
    if (rng() > 0.3) fracture(end, heading - turn, length * (0.42 + rng() * 0.12), depth + 1);
  };

  const baseLength = Math.min(width * 0.08, usableBottom * 0.18);
  for (let index = 2; index < baseline.length - 2; index += 2) {
    const prev = baseline[index - 1];
    const next = baseline[index + 1];
    const tangent = Math.atan2(next.y - prev.y, next.x - prev.x);
    const side = index % 4 === 0 ? -1 : 1;
    fracture(
      baseline[index],
      tangent + side * (Math.PI / 2 + (rng() - 0.5) * 0.2),
      baseLength * (0.56 + rng() * 0.72),
      1
    );
  }
}

function drawMycelial(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const titleBand = Math.min(150, height * 0.16);
  const usableBottom = height - titleBand;
  const center = { x: width / 2, y: usableBottom * 0.48 };
  const radiusX = width * 0.44;
  const radiusY = usableBottom * 0.42;
  const count = width / height > 1.8 ? 58 : width < 700 ? 32 : 46;
  const points: Vec2[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radial = Math.sqrt(rng()) * 0.96;
    points.push({
      x: center.x + Math.cos(angle) * radiusX * radial,
      y: center.y + Math.sin(angle) * radiusY * radial,
    });
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let index = 0; index < points.length; index += 1) {
    const nearest = points
      .map((point, other) => ({ other, d: other === index ? Number.POSITIVE_INFINITY : distanceSquared(points[index], point) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    if (nearest.length < 2) continue;

    const a = points[nearest[0].other];
    const b = points[nearest[1].other];
    const fork = {
      x: points[index].x * 0.48 + a.x * 0.27 + b.x * 0.25 + (rng() - 0.5) * radiusX * 0.025,
      y: points[index].y * 0.48 + a.y * 0.27 + b.y * 0.25 + (rng() - 0.5) * radiusY * 0.035,
    };

    const drawEdge = (from: Vec2, to: Vec2, alpha: number, lineWidth: number) => {
      const mx = (from.x + to.x) / 2 + (rng() - 0.5) * 12;
      const my = (from.y + to.y) / 2 + (rng() - 0.5) * 12;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(mx, my, to.x, to.y);
      ctx.strokeStyle = `rgba(118, 177, 193, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    drawEdge(points[index], fork, 0.24, 0.58);
    drawEdge(fork, a, 0.2, 0.46);
    drawEdge(fork, b, 0.17, 0.38);

    ctx.beginPath();
    ctx.arc(fork.x, fork.y, rng() > 0.7 ? 1.15 : 0.72, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(146, 211, 220, 0.24)';
    ctx.fill();
  }
}

function drawPixelGhost(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const size = Math.min(width, height);
  const cell = Math.max(6, Math.min(16, size / 42));
  const grid = 19;
  const originX = width / 2 - (grid * cell) / 2;
  const originY = height * 0.42 - (grid * cell) / 2;
  const key = (x: number, y: number) => `${x},${y}`;
  let live = new Set<string>();

  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const radial = Math.hypot(x - grid / 2, y - grid / 2) / (grid * 0.7);
      if (rng() > 0.66 + radial * 0.12) live.add(key(x, y));
    }
  }
  for (let index = 6; index <= 12; index += 1) {
    live.add(key(index, 9));
    live.add(key(9, index));
  }

  const offsets = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);

  for (let generation = 0; generation < 5; generation += 1) {
    const block = cell * Math.pow(0.88, generation);
    const offset = (cell - block) / 2;
    for (const encoded of live) {
      const [x, y] = encoded.split(',').map(Number);
      const alpha = Math.max(0.08, 0.26 - generation * 0.035);
      ctx.fillStyle = `rgba(151, 205, 216, ${alpha})`;
      ctx.fillRect(originX + x * cell + offset, originY + y * cell + offset, block, block);
    }

    const candidates = new Set<string>();
    for (const encoded of live) {
      const [x, y] = encoded.split(',').map(Number);
      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < grid && ny >= 0 && ny < grid) candidates.add(key(nx, ny));
      }
    }

    const next = new Set<string>();
    for (const encoded of candidates) {
      const [x, y] = encoded.split(',').map(Number);
      let neighbors = 0;
      for (const [dx, dy] of offsets) if (live.has(key(x + dx, y + dy))) neighbors += 1;
      if (live.has(encoded) && (neighbors === 2 || neighbors === 3)) next.add(encoded);
      if (!live.has(encoded) && neighbors === 3) next.add(encoded);
    }
    live = next;
    if (live.size < 6) break;
  }
}

function drawSpiraloid(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const usableBottom = height - Math.min(150, height * 0.16);
  const center = { x: width / 2, y: usableBottom * 0.48 };
  const radius = Math.min(width, usableBottom) * 0.31;
  const chirality = rng() > 0.5 ? 1 : -1;

  for (const phase of [0, Math.PI]) {
    ctx.beginPath();
    const turns = 3.3;
    const steps = 180;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const theta = phase + chirality * t * Math.PI * 2 * turns;
      const radial = radius * (0.96 - t * 0.79);
      const depthScale = 0.34 + 0.66 * (1 - t);
      const x = center.x + Math.cos(theta) * radial;
      const y = center.y + Math.sin(theta) * radial * 0.62 * depthScale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(111, 198, 214, 0.13)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (let ring = 0; ring < 14; ring += 1) {
    const t = ring / 13;
    const theta = chirality * t * Math.PI * 2 * 3.3;
    const radial = radius * (0.96 - t * 0.79);
    const a = {
      x: center.x + Math.cos(theta) * radial,
      y: center.y + Math.sin(theta) * radial * 0.62 * (0.34 + 0.66 * (1 - t)),
    };
    const b = {
      x: center.x + Math.cos(theta + Math.PI) * radial,
      y: center.y + Math.sin(theta + Math.PI) * radial * 0.62 * (0.34 + 0.66 * (1 - t)),
    };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(132, 191, 202, ${0.055 + (1 - t) * 0.04})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

export function FractalSurfaceEnhancer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let lastSignature = '';

    const render = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      const morphology = root?.dataset.fractalMorphology as Morphology | undefined;
      const seed = root?.dataset.fractalSeed;
      if (!root || !seed || !morphology) return;

      const supported = ['tectonic', 'mycelial', 'pixel-ghost', 'spiraloid'] as const;
      if (!supported.includes(morphology as (typeof supported)[number])) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        lastSignature = `${morphology}:${seed}:clear`;
        return;
      }

      const rect = root.getBoundingClientRect();
      const width = Math.round(rect.width || window.innerWidth);
      const height = Math.round(rect.height || window.innerHeight);
      const signature = `${morphology}:${seed}:${width}x${height}`;
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
      const rng = seededRng(`surface-v1:${morphology}:${seed}:${width}x${height}`);

      if (morphology === 'tectonic') drawTectonic(ctx, width, height, rng);
      if (morphology === 'mycelial') drawMycelial(ctx, width, height, rng);
      if (morphology === 'pixel-ghost') drawPixelGhost(ctx, width, height, rng);
      if (morphology === 'spiraloid') drawSpiraloid(ctx, width, height, rng);
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
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
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[8]"
      aria-hidden="true"
      data-fractal-surface-enhancer
    />
  );
}
