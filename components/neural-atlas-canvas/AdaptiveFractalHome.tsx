'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildAdaptiveFractalTree,
  clamp,
  unitVectorFromCenter,
  type Dimensions,
  type FractalPath,
  type FractalTree,
  type Vec2,
} from '@/lib/home/fractalDendrite';
import { VISUAL_LIMITS } from './visualLimits';

type Destination = {
  id: string;
  label: string;
  compactLabel: string;
  href: string;
  color: string;
};

type LabelPosition = {
  x: number;
  y: number;
};

const DESTINATIONS: Destination[] = [
  { id: 'frontier', label: 'FRONTIER', compactLabel: 'FRONTIER', href: '/frontier', color: '#78ebff' },
  { id: 'games', label: 'Game Network', compactLabel: 'Games', href: '/arcade', color: '#a2e8dc' },
  { id: 'builds', label: 'Builds', compactLabel: 'Builds', href: '/projects', color: '#b6d7df' },
  { id: 'systems', label: 'Deployed Systems', compactLabel: 'Systems', href: '/case-studies', color: '#d6ddd3' },
  { id: 'contact', label: 'Contact', compactLabel: 'Contact', href: '/contact', color: '#c2ceda' },
  { id: 'visuals', label: 'Visual Cortex', compactLabel: 'Visuals', href: '/photography', color: '#d7c9d1' },
  { id: 'research', label: 'Research', compactLabel: 'Research', href: '/ideas', color: '#c9d9cf' },
  { id: 'papers', label: 'Paper Archive', compactLabel: 'Papers', href: '/publications', color: '#c8d2dd' },
];

const INITIAL_DIMENSIONS: Dimensions = { width: 0, height: 0 };
const HOME_BRANCH_COUNT = DESTINATIONS.length;
const CODE_TEXT: CSSProperties = {
  fontFamily:
    '"Roboto Mono", "IBM Plex Mono", "Berkeley Mono", "Aptos Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", var(--font-geist-mono), monospace',
  fontFeatureSettings: '"zero" 1, "ss02" 1, "calt" 1',
  textRendering: 'geometricPrecision',
};

function getViewportDimensions(container: HTMLElement): Dimensions {
  const rect = container.getBoundingClientRect();
  const viewport = window.visualViewport;
  return {
    width: Math.round(rect.width || viewport?.width || window.innerWidth || 0),
    height: Math.round(rect.height || viewport?.height || window.innerHeight || 0),
  };
}

function entropySeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.round(performance.now()).toString(36)}`;
}

function newSessionSeed(): string {
  const params = new URLSearchParams(window.location.search);
  const requestedSeed = params.get('seed')?.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 72);
  const requestedMorphology = params.get('morph')?.toLowerCase();
  const base = requestedSeed || entropySeed();
  if (requestedMorphology && /^[a-z-]+$/.test(requestedMorphology)) {
    return `force:${requestedMorphology}:${base}`;
  }
  return base;
}

function estimateLabelHalfWidth(destination: Destination, compact: boolean): number {
  const label = compact ? destination.compactLabel : destination.label;
  const glyphWidth = compact ? 5.8 : 6.8;
  return Math.max(compact ? 31 : 38, label.length * glyphWidth * 0.5 + (compact ? 13 : 18));
}

function getLabelPosition(
  destination: Destination,
  endpoint: Vec2,
  tree: FractalTree,
  dimensions: Dimensions
): LabelPosition {
  const direction = unitVectorFromCenter(endpoint, tree.center);
  const compact = tree.compact;
  const halfWidth = estimateLabelHalfWidth(destination, compact);
  const outward = compact ? 19 : 27;
  const verticalNudge = Math.abs(direction.y) > 0.74 ? (direction.y < 0 ? -8 : 8) : 0;
  const x = endpoint.x + direction.x * outward;
  const y = endpoint.y + direction.y * (compact ? 15 : 20) + verticalNudge;

  return {
    x: clamp(x, halfWidth + 10, dimensions.width - halfWidth - 10),
    y: clamp(y, 26, tree.usableBottom - 24),
  };
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Vec2[]) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

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
  if (points.length > 2 && points[0] === last) ctx.closePath();
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Vec2[]) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
}

function branchColor(path: FractalPath, active: boolean, alpha: number): string {
  if (active) return `rgba(111, 238, 255, ${alpha})`;
  if (path.depth === 0) return `rgba(208, 230, 226, ${alpha})`;
  if (path.depth <= 2) return `rgba(158, 198, 210, ${alpha})`;
  return `rgba(139, 153, 190, ${alpha})`;
}

function drawStencilPath(ctx: CanvasRenderingContext2D, path: FractalPath) {
  drawPolygon(ctx, path.points);
  if (path.depth === 0) {
    ctx.fillStyle = 'rgba(79, 222, 245, 0.025)';
    ctx.fill();
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${clamp(0.76 - path.depth * 0.07, 0.42, 0.76)})`;
    ctx.fill();
    ctx.restore();
  }

  drawPolygon(ctx, path.points);
  ctx.strokeStyle = `rgba(150, 211, 222, ${path.alpha})`;
  ctx.lineWidth = path.width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function AdaptiveFractalHome() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
  const [sessionSeed, setSessionSeed] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tree = useMemo(() => {
    if (!sessionSeed || dimensions.width <= 0 || dimensions.height <= 0) return null;
    return buildAdaptiveFractalTree(
      dimensions,
      sessionSeed,
      DESTINATIONS.map((destination) => destination.id)
    );
  }, [dimensions, sessionSeed]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    let active = true;
    const seedFrame = requestAnimationFrame(() => {
      if (active) setSessionSeed(newSessionSeed());
    });
    const measure = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;
        const next = getViewportDimensions(container);
        if (next.width <= 0 || next.height <= 0) return;
        setDimensions((current) =>
          current.width === next.width && current.height === next.height ? current : next
        );
      });
    };

    measure();
    requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      active = false;
      cancelAnimationFrame(seedFrame);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tree) return;

    const dpr = Math.min(window.devicePixelRatio || 1, VISUAL_LIMITS.dprCap);
    canvas.width = Math.max(1, Math.round(dimensions.width * dpr));
    canvas.height = Math.max(1, Math.round(dimensions.height * dpr));
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const background = ctx.createRadialGradient(
      tree.center.x,
      tree.center.y,
      tree.morphology.id === 'halo' ? 2 : 8,
      tree.center.x,
      tree.center.y,
      Math.max(dimensions.width, dimensions.height) * 0.74
    );
    if (tree.morphology.id === 'halo') {
      background.addColorStop(0, '#010204');
      background.addColorStop(0.38, '#020408');
      background.addColorStop(0.72, '#061018');
      background.addColorStop(1, '#010204');
    } else if (tree.morphology.id === 'pixel-ghost') {
      background.addColorStop(0, '#040b10');
      background.addColorStop(0.48, '#020508');
      background.addColorStop(1, '#010204');
    } else {
      background.addColorStop(0, '#061018');
      background.addColorStop(0.28, '#03080d');
      background.addColorStop(0.68, '#020407');
      background.addColorStop(1, '#010204');
    }
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    if (tree.morphology.id !== 'pixel-ghost' && tree.morphology.id !== 'echo-nest') {
      ctx.save();
      ctx.translate(tree.center.x, tree.center.y);
      ctx.strokeStyle = 'rgba(113, 210, 229, 0.03)';
      ctx.lineWidth = 0.65;
      ctx.setLineDash([1.5, 12]);
      for (const scale of [0.42, 0.68, 0.93]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, tree.radiusX * scale, tree.radiusY * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    const stencils = tree.paths.filter((path) => path.renderMode === 'stencil').sort((a, b) => a.depth - b.depth);
    const pixels = tree.paths.filter((path) => path.renderMode === 'pixel');
    const strokes = tree.paths.filter((path) => path.renderMode === 'stroke').sort((a, b) => b.depth - a.depth);

    for (const path of stencils) drawStencilPath(ctx, path);

    for (const path of pixels) {
      const point = path.points[0];
      if (!point) continue;
      const active = hoveredId === path.ownerId;
      const dimmed = Boolean(hoveredId && !active);
      const alpha = active ? Math.min(0.92, path.alpha * 1.45) : dimmed ? path.alpha * 0.22 : path.alpha;
      const size = active ? path.width * 1.08 : path.width;
      ctx.fillStyle = active ? `rgba(111, 238, 255, ${alpha})` : `rgba(165, 208, 218, ${alpha})`;
      ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
      if (path.depth <= 2) {
        ctx.strokeStyle = `rgba(225, 242, 241, ${alpha * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
      }
    }

    for (const path of strokes) {
      const active = hoveredId === path.ownerId;
      const dimmed = Boolean(hoveredId && !active);
      const alpha = active ? Math.min(0.98, path.alpha * 1.55) : dimmed ? path.alpha * 0.24 : path.alpha;
      const width = active ? path.width * 1.12 : path.width;
      const glow = path.glow ?? 0;

      if (!dimmed && glow > 0) {
        drawSmoothPath(ctx, path.points);
        ctx.strokeStyle = active
          ? `rgba(83, 229, 255, ${Math.min(0.18, 0.055 * glow + 0.04)})`
          : `rgba(122, 211, 224, ${Math.min(0.11, 0.035 * glow + 0.02)})`;
        ctx.lineWidth = width + glow * 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (path.depth === 0 && !dimmed) {
        drawSmoothPath(ctx, path.points);
        ctx.strokeStyle = active ? 'rgba(83, 229, 255, 0.12)' : 'rgba(153, 218, 222, 0.055)';
        ctx.lineWidth = width + (active ? 8 : 5);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      drawSmoothPath(ctx, path.points);
      ctx.strokeStyle = branchColor(path, active, alpha);
      ctx.lineWidth = width;
      ctx.lineCap = tree.morphology.id === 'tectonic' ? 'butt' : 'round';
      ctx.lineJoin = tree.morphology.id === 'tectonic' ? 'miter' : 'round';
      ctx.stroke();
    }

    DESTINATIONS.forEach((destination) => {
      const endpoint = tree.endpoints.get(destination.id);
      if (!endpoint) return;
      const active = hoveredId === destination.id;
      const dimmed = Boolean(hoveredId && !active);

      ctx.beginPath();
      ctx.arc(endpoint.x, endpoint.y, active ? 3.8 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = destination.color;
      ctx.globalAlpha = active ? 0.96 : dimmed ? 0.22 : 0.64;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (!['halo', 'mycelial', 'pixel-ghost', 'echo-nest'].includes(tree.morphology.id)) {
      ctx.beginPath();
      ctx.arc(tree.center.x, tree.center.y, hoveredId ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = hoveredId ? 'rgba(224, 247, 248, 0.84)' : 'rgba(202, 224, 225, 0.58)';
      ctx.fill();
    }
  }, [dimensions, hoveredId, tree]);

  const isMeasured = Boolean(tree);
  const showSoma = tree && !['halo', 'mycelial', 'pixel-ghost', 'echo-nest'].includes(tree.morphology.id);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-[#010204]"
      data-home-branch-count={HOME_BRANCH_COUNT}
      data-fractal-morphology={tree?.morphology.id ?? 'measuring'}
      data-fractal-dimension={tree ? tree.theoreticalTerminalDimension.toFixed(3) : undefined}
      data-fractal-seed={sessionSeed ?? undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(1,2,4,0.26),transparent_18%,transparent_76%,rgba(1,2,4,0.82))]" />

      {tree && (
        <>
          <nav
            aria-label="Primary homepage destinations"
            className={`absolute inset-0 z-20 transition-opacity duration-200 ${isMeasured ? 'opacity-100' : 'opacity-0'}`}
          >
            {DESTINATIONS.map((destination) => {
              const endpoint = tree.endpoints.get(destination.id);
              if (!endpoint) return null;
              const position = getLabelPosition(destination, endpoint, tree, dimensions);
              const active = hoveredId === destination.id;

              return (
                <Link
                  key={destination.id}
                  href={destination.href}
                  data-dendrite-destination={destination.id}
                  data-gesture-target
                  aria-label={`Open ${destination.label}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[2px] border px-2.5 py-1.5 text-[9px] uppercase tracking-[0.12em] transition-all duration-200 sm:px-3 sm:py-2 sm:text-[10px] lg:text-[11px] ${
                    active
                      ? 'scale-[1.035] border-cyan-300/45 bg-[#041016]/92 text-cyan-200 shadow-[0_0_24px_rgba(92,229,255,0.14)]'
                      : 'border-white/10 bg-black/58 text-white/62 hover:border-white/25 hover:bg-black/76 hover:text-white/92'
                  }`}
                  style={{ ...CODE_TEXT, left: position.x, top: position.y }}
                  onMouseEnter={() => setHoveredId(destination.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(destination.id)}
                  onBlur={() => setHoveredId(null)}
                >
                  <span className="hidden min-[520px]:inline">{destination.label}</span>
                  <span className="min-[520px]:hidden">{destination.compactLabel}</span>
                </Link>
              );
            })}
          </nav>

          {showSoma && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: tree.center.x, top: tree.center.y }}
              aria-hidden="true"
            >
              <svg width="70" height="70" viewBox="0 0 70 70" className="overflow-visible">
                <path
                  d="M35 7 L52 15 L61 32 L55 51 L38 62 L19 56 L8 39 L13 20 Z"
                  fill="rgba(255,255,255,0.026)"
                  stroke="rgba(222,241,242,0.17)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M35 14 L48 20 L54 33 L50 46 L37 54 L23 50 L16 38 L20 24 Z"
                  fill="rgba(92,226,255,0.018)"
                  stroke="rgba(92,226,255,0.075)"
                  strokeWidth="0.7"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )}

          <Link
            href="/about"
            data-gesture-target
            className="absolute z-30 -translate-x-1/2 rounded-[2px] border border-white/12 bg-black/68 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/72 transition-all hover:border-cyan-300/35 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/60 sm:text-[10px]"
            style={{ left: tree.center.x, top: tree.center.y + (tree.compact ? 42 : 48) }}
          >
            Core
          </Link>

          <div
            className="pointer-events-none absolute left-1/2 top-5 z-10 hidden -translate-x-1/2 text-center min-[520px]:block"
            aria-hidden="true"
          >
            <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/18">
              DENDRITIC FIELD · {tree.morphology.label} · D≈{tree.theoreticalTerminalDimension.toFixed(2)}
            </p>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute bottom-[4.65rem] left-1/2 z-20 w-[min(94vw,94rem)] -translate-x-1/2 text-center min-[520px]:bottom-5 sm:bottom-7 lg:bottom-8">
        <h1
          className="font-medium leading-none tracking-[0.16em] text-white/90 min-[520px]:tracking-[0.18em]"
          style={{ ...CODE_TEXT, fontSize: tree?.compact ? '1.16rem' : 'clamp(1.45rem, 2.55vw, 2.8rem)' }}
        >
          SIDHARTH HULYALKAR
        </h1>
        <p
          className="mx-auto mt-2 max-w-[78rem] text-[7px] uppercase leading-relaxed tracking-[0.08em] text-white/34 min-[520px]:text-[8px] min-[520px]:tracking-[0.09em] sm:text-[9px] md:text-[10px]"
          style={CODE_TEXT}
        >
          <span className="min-[520px]:hidden">NEURAL DATA SYSTEMS · SCIENTIFIC SOFTWARE</span>
          <span className="hidden min-[520px]:inline">
            NEURAL DATA SYSTEMS · MULTIMODAL FOUNDATION MODELING &amp; INTERPRETABILITY · SCIENTIFIC SOFTWARE
          </span>
        </p>
      </div>
    </div>
  );
}
