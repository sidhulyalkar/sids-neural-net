'use client';

import { useEffect, useRef } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };

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

function polygonVertices(center: Vec2, rx: number, ry: number, rotation: number, sides: number): Vec2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation - Math.PI / 2 + (index / sides) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    };
  });
}

function drawPolygon(ctx: CanvasRenderingContext2D, vertices: Vec2[], alpha: number, width: number, glow = 0) {
  if (vertices.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let index = 1; index < vertices.length; index += 1) ctx.lineTo(vertices[index].x, vertices[index].y);
  ctx.closePath();
  if (glow > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(74, 225, 232, ${alpha * 0.2})`;
    ctx.lineWidth = width + glow * 5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = `rgba(124, 207, 215, ${alpha})`;
  ctx.lineWidth = width;
  ctx.lineJoin = 'miter';
  ctx.stroke();
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

function drawCellCloud(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  center: Vec2,
  spreadX: number,
  spreadY: number,
  count: number,
  baseSize: number,
  keyPhase: number
) {
  const cells: Vec2[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + keyPhase + (rng() - 0.5) * 0.22;
    const radial = 0.54 + (index % 5) * 0.105 + rng() * 0.1;
    const point = {
      x: center.x + Math.cos(angle) * spreadX * radial,
      y: center.y + Math.sin(angle) * spreadY * radial,
    };
    cells.push(point);
    const sides = index % 7 === 0 ? 6 : index % 4 === 0 ? 3 : 4;
    const scale = baseSize * (0.58 + rng() * 0.86);
    const vertices = polygonVertices(
      point,
      scale * (0.82 + rng() * 0.4),
      scale * (0.72 + rng() * 0.48),
      angle * 0.43 + rng() * 0.7,
      sides
    );
    drawPolygon(ctx, vertices, 0.075 + rng() * 0.12, 0.32 + rng() * 0.36, index % 9 === 0 ? 0.12 : 0);

    if (index % 3 === 0) {
      const inner = polygonVertices(point, scale * 0.58, scale * 0.5, angle * 0.43 + 0.23, sides);
      drawPolygon(ctx, inner, 0.045 + rng() * 0.055, 0.3);
    }
  }

  for (let index = 0; index < cells.length; index += 1) {
    const next = cells[(index + 1) % cells.length];
    const skip = cells[(index + 2) % cells.length];
    if (rng() > 0.12) {
      drawBridge(
        ctx,
        cells[index],
        next,
        {
          x: (cells[index].x + next.x) * 0.5 + (rng() - 0.5) * baseSize * 0.9,
          y: (cells[index].y + next.y) * 0.5 + (rng() - 0.5) * baseSize * 0.9,
        },
        0.055,
        0.3
      );
    }
    if (index % 4 === 0 && rng() > 0.34) {
      drawBridge(
        ctx,
        cells[index],
        skip,
        {
          x: (cells[index].x + skip.x) * 0.5 + (rng() - 0.5) * baseSize,
          y: (cells[index].y + skip.y) * 0.5 + (rng() - 0.5) * baseSize,
        },
        0.035,
        0.26
      );
    }
  }
}

function drawExpandedEchoNest(ctx: CanvasRenderingContext2D, width: number, height: number, seed: string) {
  const rng = seededRng(`echo-nest-v7-surface:${seed}:${width}x${height}`);
  const titleBand = clamp(height * 0.14, 86, 138);
  const usableBottom = height - titleBand;
  const center = { x: width * 0.5, y: usableBottom * 0.47 };
  const rx = width * (width / height > 2 ? 0.37 : 0.32);
  const ry = usableBottom * 0.35;

  // Two interleaved polygonal mantles create the dense folded silhouette from the reference.
  drawCellCloud(ctx, rng, center, rx, ry, width < 620 ? 19 : 40, Math.min(width, height) * 0.048, 0.05);
  drawCellCloud(
    ctx,
    rng,
    { x: center.x - rx * 0.04, y: center.y + ry * 0.04 },
    rx * 0.72,
    ry * 0.7,
    width < 620 ? 15 : 31,
    Math.min(width, height) * 0.043,
    0.41
  );

  // Central polygonal nucleus, intentionally compact so a quiet pocket can still exist for CORE.
  drawCellCloud(
    ctx,
    rng,
    { x: center.x + rx * 0.02, y: center.y - ry * 0.015 },
    rx * 0.22,
    ry * 0.22,
    width < 620 ? 8 : 17,
    Math.min(width, height) * 0.032,
    0.18
  );

  // A detached upper-right satellite mirrors the reference's second lobed island.
  if (width >= 760) {
    const satellite = { x: center.x + rx * 0.94, y: center.y - ry * 0.98 };
    drawCellCloud(
      ctx,
      rng,
      satellite,
      rx * 0.18,
      ry * 0.27,
      width / height > 1.6 ? 20 : 14,
      Math.min(width, height) * 0.036,
      0.73
    );
    const neck = { x: center.x + rx * 0.72, y: center.y - ry * 0.65 };
    drawBridge(ctx, neck, satellite, { x: neck.x + rx * 0.12, y: neck.y - ry * 0.14 }, 0.07, 0.34);
  }

  // Long sparse chords preserve the navigational feeling instead of making the whole field uniformly noisy.
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2 + (rng() - 0.5) * 0.09;
    const a = {
      x: center.x + Math.cos(angle) * rx * (0.12 + rng() * 0.12),
      y: center.y + Math.sin(angle) * ry * (0.12 + rng() * 0.12),
    };
    const b = {
      x: center.x + Math.cos(angle + (rng() - 0.5) * 0.09) * rx * (0.92 + rng() * 0.14),
      y: center.y + Math.sin(angle + (rng() - 0.5) * 0.09) * ry * (0.92 + rng() * 0.14),
    };
    drawBridge(ctx, a, b, { x: (a.x + b.x) * 0.5 + (rng() - 0.5) * rx * 0.08, y: (a.y + b.y) * 0.5 + (rng() - 0.5) * ry * 0.12 }, 0.047, 0.3);
  }
}

function candidateDensity(canvases: HTMLCanvasElement[], x: number, y: number, boxW: number, boxH: number): number {
  let density = 0;
  let samples = 0;
  const step = 12;
  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) continue;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    for (let sy = y - boxH * 0.5; sy <= y + boxH * 0.5; sy += step) {
      for (let sx = x - boxW * 0.5; sx <= x + boxW * 0.5; sx += step) {
        const px = clamp(Math.round((sx - rect.left) * scaleX), 0, canvas.width - 1);
        const py = clamp(Math.round((sy - rect.top) * scaleY), 0, canvas.height - 1);
        const data = ctx.getImageData(px, py, 1, 1).data;
        const brightness = Math.max(data[0], data[1], data[2]);
        const visibleInk = data[3] / 255 * Math.max(0, brightness - 18);
        density += visibleInk;
        samples += 1;
      }
    }
  }
  return samples ? density / samples : 0;
}

function placeCoreInQuietPocket(root: HTMLElement) {
  const core = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href="/about"]')).find(
    (link) => link.textContent?.trim().toLowerCase() === 'core'
  );
  if (!core) return;

  const rect = root.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return;

  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas')).filter((canvas) => {
    const box = canvas.getBoundingClientRect();
    return box.width >= width * 0.75 && box.height >= height * 0.7;
  });
  const compact = width < 620;
  const centerX = width * 0.5;
  const centerY = height * (compact ? 0.42 : 0.405);
  const searchRadiusX = width * (compact ? 0.18 : 0.245);
  const searchRadiusY = height * (compact ? 0.15 : 0.205);
  const boxW = compact ? 94 : 122;
  const boxH = compact ? 52 : 62;
  let best = { x: centerX, y: centerY, score: Number.POSITIVE_INFINITY, density: Number.POSITIVE_INFINITY };

  for (let gy = -3; gy <= 3; gy += 1) {
    for (let gx = -4; gx <= 4; gx += 1) {
      const x = centerX + (gx / 4) * searchRadiusX;
      const y = centerY + (gy / 3) * searchRadiusY;
      const density = candidateDensity(canvases, x, y, boxW, boxH);
      const radialPenalty = Math.hypot((x - centerX) / searchRadiusX, (y - centerY) / searchRadiusY) * 7.5;
      const lowerPenalty = y > height * 0.64 ? 24 : 0;
      const score = density + radialPenalty + lowerPenalty;
      if (score < best.score) best = { x, y, score, density };
    }
  }

  core.style.left = `${best.x}px`;
  core.style.top = `${best.y}px`;
  core.style.transform = 'translate(-50%, -50%)';
  core.style.background = 'rgba(2, 8, 12, 0.92)';
  core.style.boxShadow = '0 0 0 1px rgba(215,240,240,0.06), 0 0 28px rgba(1,4,7,0.86)';
  core.dataset.corePlacement = 'quiet-pocket-v1';
  core.dataset.coreDensity = best.density.toFixed(2);
  core.setAttribute('aria-label', 'Open core / about');
}

export function FractalExperienceV3() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let placementFrame = 0;
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
      const width = Math.round(rect.width || window.innerWidth);
      const height = Math.round(rect.height || window.innerHeight);
      const signature = `${morphology}:${seed}:${width}x${height}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, width, height);
          if (morphology === 'echo-nest') drawExpandedEchoNest(ctx, width, height, seed);
        }
      }

      cancelAnimationFrame(placementFrame);
      placementFrame = requestAnimationFrame(() => requestAnimationFrame(() => placeCoreInQuietPocket(root)));
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
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(placementFrame);
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
    />
  );
}
