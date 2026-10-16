'use client';

import { useEffect, useRef } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };
type Morphology = 'tectonic' | 'pixel-ghost' | 'spiraloid' | 'echo-nest';

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

function drawPolyline(ctx: CanvasRenderingContext2D, points: Vec2[], alpha: number, width: number) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.strokeStyle = `rgba(144, 192, 204, ${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

function drawTectonic(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const titleBand = Math.min(150, height * 0.16);
  const usableBottom = height - titleBand;
  const centerY = usableBottom * 0.48;
  const faults: Vec2[][] = [];
  const steps = width / height > 2 ? 54 : 42;

  for (let faultIndex = 0; faultIndex < 4; faultIndex += 1) {
    const points: Vec2[] = [];
    const phase = rng() * Math.PI * 2;
    const baseBias = (faultIndex - 1.5) * usableBottom * 0.09;
    const tilt = (faultIndex - 1.5) * 0.09 + (rng() - 0.5) * 0.045;
    let walk = 0;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      walk = walk * 0.76 + (rng() - 0.5) * usableBottom * 0.018;
      const x = 28 + t * (width - 56);
      const y =
        centerY +
        baseBias +
        (x - width * 0.5) * tilt +
        Math.sin(t * Math.PI * (2.3 + faultIndex * 0.24) + phase) * usableBottom * 0.045 +
        Math.sin(t * Math.PI * 8.2 + phase * 0.5) * usableBottom * 0.009 +
        walk;
      points.push({ x, y: clamp(y, 42, usableBottom - 42) });
    }
    faults.push(points);
    drawPolyline(ctx, points, faultIndex === 1 || faultIndex === 2 ? 0.16 : 0.11, faultIndex === 1 ? 0.72 : 0.48);
  }

  const fracture = (start: Vec2, heading: number, length: number, depth: number) => {
    if (depth > 3 || length < 10) return;
    const joints = depth === 1 ? 4 : 3;
    const points = [start];
    let current = start;
    let angle = heading;
    for (let index = 0; index < joints; index += 1) {
      angle += (rng() - 0.5) * (0.44 + depth * 0.12);
      const segment = length / joints;
      current = {
        x: clamp(current.x + Math.cos(angle) * segment, 22, width - 22),
        y: clamp(current.y + Math.sin(angle) * segment, 34, usableBottom - 34),
      };
      points.push(current);
    }
    drawPolyline(ctx, points, Math.max(0.07, 0.17 - depth * 0.027), Math.max(0.26, 0.56 - depth * 0.1));
    const end = points[points.length - 1];
    if (rng() > 0.24) fracture(end, angle + (rng() > 0.5 ? 1 : -1) * (0.78 + rng() * 0.58), length * 0.5, depth + 1);
  };

  for (let faultIndex = 0; faultIndex < faults.length; faultIndex += 1) {
    const fault = faults[faultIndex];
    for (let index = 3; index < fault.length - 3; index += 3) {
      if (rng() < 0.24) continue;
      const prev = fault[index - 1];
      const next = fault[index + 1];
      const tangent = Math.atan2(next.y - prev.y, next.x - prev.x);
      const side = (index + faultIndex) % 2 === 0 ? -1 : 1;
      fracture(
        fault[index],
        tangent + side * (Math.PI / 2 + (rng() - 0.5) * 0.48),
        Math.min(width * 0.065, usableBottom * 0.2) * (0.55 + rng() * 0.75),
        1
      );
    }
  }

  for (let index = 4; index < steps - 4; index += 5) {
    const a = faults[index % 2][index];
    const b = faults[2 + (index % 2)][Math.min(steps, index + (index % 3) - 1)];
    if (!a || !b || rng() < 0.26) continue;
    const bend = {
      x: a.x * 0.46 + b.x * 0.54 + (rng() - 0.5) * width * 0.025,
      y: a.y * 0.46 + b.y * 0.54 + (rng() - 0.5) * usableBottom * 0.055,
    };
    drawPolyline(ctx, [a, bend, b], 0.115, 0.38);
  }
}

function polygonPath(ctx: CanvasRenderingContext2D, center: Vec2, rx: number, ry: number, rotation: number, sides: number) {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation - Math.PI / 2 + (index / sides) * Math.PI * 2;
    const point = { x: center.x + Math.cos(angle) * rx, y: center.y + Math.sin(angle) * ry };
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function drawEchoNestMatte(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const usableBottom = height - Math.min(150, height * 0.16);
  const center = { x: width * 0.5, y: usableBottom * 0.48 };
  const radiusX = width * 0.23;
  const radiusY = usableBottom * 0.29;

  for (let index = 0; index < 13; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radial = 0.14 + Math.sqrt(rng()) * 0.86;
    const shapeCenter = {
      x: center.x + Math.cos(angle) * radiusX * radial,
      y: center.y + Math.sin(angle) * radiusY * radial,
    };
    const sides = index % 5 === 0 ? 6 : index % 3 === 0 ? 3 : 4;
    const scale = 0.56 + rng() * 0.82;
    const rx = (26 + rng() * 46) * scale;
    const ry = (20 + rng() * 42) * scale;
    const rotation = angle * 0.34 + (rng() - 0.5) * 0.7;

    ctx.save();
    polygonPath(ctx, shapeCenter, rx, ry, rotation, sides);
    ctx.clip();
    ctx.fillStyle = `rgba(235, 238, 232, ${0.012 + rng() * 0.012})`;
    ctx.fillRect(shapeCenter.x - rx, shapeCenter.y - ry, rx * 2, ry * 2);

    ctx.strokeStyle = `rgba(226, 232, 226, ${0.045 + rng() * 0.025})`;
    ctx.lineWidth = 0.45;
    const spacing = 8 + rng() * 4;
    for (let y = shapeCenter.y - ry * 1.5; y <= shapeCenter.y + ry * 1.5; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(shapeCenter.x - rx * 1.5, y);
      ctx.lineTo(shapeCenter.x + rx * 1.5, y + rx * 0.32);
      ctx.stroke();
    }

    for (let dot = 0; dot < 22; dot += 1) {
      const x = shapeCenter.x + (rng() - 0.5) * rx * 1.7;
      const y = shapeCenter.y + (rng() - 0.5) * ry * 1.7;
      ctx.fillStyle = `rgba(245, 246, 240, ${0.035 + rng() * 0.045})`;
      ctx.fillRect(x, y, 0.7 + rng() * 0.8, 0.7 + rng() * 0.8);
    }
    ctx.restore();
  }
}

function drawPixelGhost(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const size = Math.min(width, height);
  const cell = Math.max(6, Math.min(15, size / 44));
  const grid = 19;
  const originX = width / 2 - (grid * cell) / 2;
  const originY = height * 0.42 - (grid * cell) / 2;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const radial = Math.hypot(x - 9, y - 9) / 12;
      if (rng() < 0.3 - radial * 0.08) {
        const block = cell * (0.58 + rng() * 0.38);
        ctx.fillStyle = `rgba(151, 205, 216, ${0.07 + rng() * 0.11})`;
        ctx.fillRect(originX + x * cell, originY + y * cell, block, block);
      }
    }
  }
}

function drawSpiraloid(ctx: CanvasRenderingContext2D, width: number, height: number, rng: () => number) {
  const usableBottom = height - Math.min(150, height * 0.16);
  const center = { x: width / 2, y: usableBottom * 0.48 };
  const radius = Math.min(width, usableBottom) * 0.31;
  const chirality = rng() > 0.5 ? 1 : -1;
  for (const phase of [0, Math.PI]) {
    ctx.beginPath();
    for (let index = 0; index <= 160; index += 1) {
      const t = index / 160;
      const theta = phase + chirality * t * Math.PI * 2 * 3.25;
      const radial = radius * (0.96 - t * 0.79);
      const x = center.x + Math.cos(theta) * radial;
      const y = center.y + Math.sin(theta) * radial * 0.56 * (0.4 + 0.6 * (1 - t));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(111, 198, 214, 0.1)';
    ctx.lineWidth = 0.68;
    ctx.stroke();
  }
}

export function FractalSurfaceEnhancerV2() {
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

      const supported = ['tectonic', 'pixel-ghost', 'spiraloid', 'echo-nest'] as const;
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

      if (!supported.includes(morphology as (typeof supported)[number])) return;
      const rng = seededRng(`surface-v2:${morphology}:${seed}:${width}x${height}`);
      if (morphology === 'tectonic') drawTectonic(ctx, width, height, rng);
      if (morphology === 'echo-nest') drawEchoNestMatte(ctx, width, height, rng);
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
      data-fractal-surface-enhancer="v2"
    />
  );
}
