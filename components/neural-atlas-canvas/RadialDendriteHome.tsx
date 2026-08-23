'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { VISUAL_LIMITS } from './visualLimits';

type Vec2 = { x: number; y: number };
type Dimensions = { width: number; height: number };
type DendritePath = {
  id: string;
  ownerId: string;
  depth: 0 | 1 | 2 | 3;
  points: Vec2[];
};

type Destination = {
  id: string;
  label: string;
  compactLabel: string;
  href: string;
  color: string;
};

const DESTINATIONS: Destination[] = [
  { id: 'frontier', label: 'FRONTIER', compactLabel: 'FRONTIER', href: '/frontier', color: '#77e8ff' },
  { id: 'games', label: 'Games', compactLabel: 'Games', href: '/arcade', color: '#9ce8dc' },
  { id: 'builds', label: 'Builds', compactLabel: 'Builds', href: '/projects', color: '#b6d7df' },
  { id: 'systems', label: 'Deployed Systems', compactLabel: 'Systems', href: '/case-studies', color: '#d6ddd3' },
  { id: 'contact', label: 'Contact', compactLabel: 'Contact', href: '/contact', color: '#c2ceda' },
  { id: 'visuals', label: 'Visual Cortex', compactLabel: 'Visuals', href: '/photography', color: '#d7c9d1' },
  { id: 'research', label: 'Research', compactLabel: 'Research', href: '/ideas', color: '#c9d9cf' },
  { id: 'papers', label: 'Paper Archive', compactLabel: 'Papers', href: '/publications', color: '#c8d2dd' },
];

const BRANCH_COUNT = 8;
const ANGLE_STEP = (Math.PI * 2) / BRANCH_COUNT;
const ANGLE_OFFSET = -Math.PI / 2;
const INITIAL_DIMENSIONS: Dimensions = { width: 0, height: 0 };
const CODE_TEXT: CSSProperties = {
  fontFamily:
    '"Roboto Mono", "IBM Plex Mono", "Berkeley Mono", "Aptos Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", var(--font-geist-mono), monospace',
  fontFeatureSettings: '"zero" 1, "ss02" 1, "calt" 1',
  textRendering: 'geometricPrecision',
};

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

function getViewportDimensions(container: HTMLElement): Dimensions {
  const rect = container.getBoundingClientRect();
  const viewport = window.visualViewport;
  return {
    width: Math.round(rect.width || viewport?.width || window.innerWidth || 0),
    height: Math.round(rect.height || viewport?.height || window.innerHeight || 0),
  };
}

function getGeometry(dimensions: Dimensions) {
  const compact = dimensions.width < 640;
  const short = dimensions.height < 620;
  const titleBand = short ? 72 : compact ? 94 : 116;
  const center: Vec2 = {
    x: dimensions.width * 0.5,
    y: dimensions.height * (short ? 0.44 : 0.43),
  };

  const horizontalRadius = clamp(dimensions.width * (compact ? 0.39 : 0.43), 132, 760);
  const verticalRadius = clamp(
    Math.min(dimensions.height * (short ? 0.30 : 0.335), dimensions.height - titleBand - center.y - 34),
    compact ? 170 : 190,
    390
  );

  return { compact, short, titleBand, center, horizontalRadius, verticalRadius };
}

function ellipsePoint(center: Vec2, angle: number, radiusX: number, radiusY: number, scale = 1): Vec2 {
  return {
    x: center.x + Math.cos(angle) * radiusX * scale,
    y: center.y + Math.sin(angle) * radiusY * scale,
  };
}

function organicPath(start: Vec2, end: Vec2, rng: () => number, segments: number, wobble = 0.025): Vec2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const perp = { x: -dy / length, y: dx / length };
  const points: Vec2[] = [start];

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const envelope = Math.sin(Math.PI * t);
    const offset = (rng() - 0.5) * length * wobble * envelope;
    points.push({
      x: start.x + dx * t + perp.x * offset,
      y: start.y + dy * t + perp.y * offset,
    });
  }

  return points;
}

function pointOnPath(points: Vec2[], t: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const scaled = clamp(t, 0, 1) * (points.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  return {
    x: points[index].x + (points[next].x - points[index].x) * local,
    y: points[index].y + (points[next].y - points[index].y) * local,
  };
}

function buildRadialTree(dimensions: Dimensions) {
  const geometry = getGeometry(dimensions);
  const rng = seededRng(`radial-dendrite-v1-${dimensions.width}x${dimensions.height}`);
  const paths: DendritePath[] = [];
  const endpoints = new Map<string, Vec2>();
  const secondaryCount = geometry.compact ? 2 : 3;
  const twigCount = 2;
  const tipSprayCount = geometry.compact ? 3 : 4;

  DESTINATIONS.forEach((destination, branchIndex) => {
    const angle = ANGLE_OFFSET + branchIndex * ANGLE_STEP;
    const primaryEnd = ellipsePoint(
      geometry.center,
      angle,
      geometry.horizontalRadius,
      geometry.verticalRadius,
      geometry.compact ? 0.96 : 1
    );
    const primary = organicPath(geometry.center, primaryEnd, rng, geometry.compact ? 9 : 12, 0.022);

    paths.push({
      id: `primary-${destination.id}`,
      ownerId: destination.id,
      depth: 0,
      points: primary,
    });

    endpoints.set(destination.id, primaryEnd);

    for (let secondaryIndex = 0; secondaryIndex < secondaryCount; secondaryIndex += 1) {
      const t = secondaryCount === 2 ? [0.48, 0.72][secondaryIndex] : [0.40, 0.60, 0.78][secondaryIndex];
      const start = pointOnPath(primary, t);
      const side = secondaryIndex % 2 === 0 ? 1 : -1;
      const fan = 0.34 + secondaryIndex * 0.06 + (rng() - 0.5) * 0.05;
      const branchAngle = angle + side * fan;
      const secondaryLength = Math.min(geometry.horizontalRadius, geometry.verticalRadius) * (geometry.compact ? 0.22 : 0.25);
      const secondaryEnd = {
        x: start.x + Math.cos(branchAngle) * secondaryLength,
        y: start.y + Math.sin(branchAngle) * secondaryLength,
      };
      const secondary = organicPath(start, secondaryEnd, rng, geometry.compact ? 5 : 6, 0.045);

      paths.push({
        id: `secondary-${destination.id}-${secondaryIndex}`,
        ownerId: destination.id,
        depth: 1,
        points: secondary,
      });

      for (let twigIndex = 0; twigIndex < twigCount; twigIndex += 1) {
        const twigStart = pointOnPath(secondary, twigIndex === 0 ? 0.62 : 0.84);
        const twigSide = twigIndex % 2 === 0 ? -side : side;
        const twigAngle = branchAngle + twigSide * (0.36 + twigIndex * 0.08 + (rng() - 0.5) * 0.06);
        const twigLength = secondaryLength * (geometry.compact ? 0.34 : 0.40);
        const twigEnd = {
          x: twigStart.x + Math.cos(twigAngle) * twigLength,
          y: twigStart.y + Math.sin(twigAngle) * twigLength,
        };
        paths.push({
          id: `twig-${destination.id}-${secondaryIndex}-${twigIndex}`,
          ownerId: destination.id,
          depth: 2,
          points: organicPath(twigStart, twigEnd, rng, 4, 0.06),
        });
      }
    }

    for (let sprayIndex = 0; sprayIndex < tipSprayCount; sprayIndex += 1) {
      const centered = sprayIndex - (tipSprayCount - 1) / 2;
      const sprayAngle = angle + centered * (geometry.compact ? 0.18 : 0.16);
      const sprayLength = Math.min(geometry.horizontalRadius, geometry.verticalRadius) * (geometry.compact ? 0.10 : 0.12);
      const sprayEnd = {
        x: primaryEnd.x + Math.cos(sprayAngle) * sprayLength,
        y: primaryEnd.y + Math.sin(sprayAngle) * sprayLength,
      };
      paths.push({
        id: `spray-${destination.id}-${sprayIndex}`,
        ownerId: destination.id,
        depth: 2,
        points: organicPath(primaryEnd, sprayEnd, rng, 4, 0.055),
      });

      const budAngle = sprayAngle + (sprayIndex % 2 === 0 ? -1 : 1) * 0.28;
      const budLength = sprayLength * 0.42;
      const budEnd = {
        x: sprayEnd.x + Math.cos(budAngle) * budLength,
        y: sprayEnd.y + Math.sin(budAngle) * budLength,
      };
      paths.push({
        id: `bud-${destination.id}-${sprayIndex}`,
        ownerId: destination.id,
        depth: 3,
        points: organicPath(sprayEnd, budEnd, rng, 3, 0.06),
      });
    }
  });

  return { ...geometry, paths, endpoints };
}

function labelPosition(
  destination: Destination,
  index: number,
  dimensions: Dimensions,
  center: Vec2,
  horizontalRadius: number,
  verticalRadius: number,
  compact: boolean,
  titleBand: number
) {
  const angle = ANGLE_OFFSET + index * ANGLE_STEP;
  const anchor = ellipsePoint(center, angle, horizontalRadius, verticalRadius, compact ? 1.02 : 1.06);
  const maxHalfWidth = compact ? 58 : destination.label.length > 11 ? 86 : 70;
  return {
    x: clamp(anchor.x, maxHalfWidth + 14, dimensions.width - maxHalfWidth - 14),
    y: clamp(anchor.y, 48, dimensions.height - titleBand - 28),
  };
}

export function RadialDendriteHome() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isMeasured = dimensions.width > 0 && dimensions.height > 0;

  const tree = useMemo(
    () => (isMeasured ? buildRadialTree(dimensions) : null),
    [dimensions, isMeasured]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    let active = true;
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
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      active = false;
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

    const gradient = ctx.createRadialGradient(
      tree.center.x,
      tree.center.y,
      12,
      tree.center.x,
      tree.center.y,
      Math.max(dimensions.width, dimensions.height) * 0.72
    );
    gradient.addColorStop(0, '#071017');
    gradient.addColorStop(0.38, '#03080d');
    gradient.addColorStop(1, '#020306');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.save();
    ctx.translate(tree.center.x, tree.center.y);
    ctx.strokeStyle = 'rgba(132, 221, 235, 0.055)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 10]);
    for (const scale of [0.30, 0.52, 0.76]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, tree.horizontalRadius * scale, tree.verticalRadius * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const ordered = [...tree.paths].sort((a, b) => b.depth - a.depth);
    for (const path of ordered) {
      const active = hoveredId === path.ownerId;
      const dimmed = Boolean(hoveredId && !active);
      const baseAlpha = [0.70, 0.48, 0.31, 0.20][path.depth];
      const width = [2.05, 1.05, 0.58, 0.32][path.depth];
      const alpha = active ? Math.min(0.96, baseAlpha * 1.48) : dimmed ? baseAlpha * 0.34 : baseAlpha;

      ctx.beginPath();
      path.points.forEach((point, pointIndex) => {
        if (pointIndex === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = active
        ? `rgba(116, 238, 255, ${alpha})`
        : path.depth === 0
          ? `rgba(205, 228, 225, ${alpha})`
          : path.depth === 1
            ? `rgba(164, 205, 214, ${alpha})`
            : `rgba(146, 166, 201, ${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    DESTINATIONS.forEach((destination) => {
      const endpoint = tree.endpoints.get(destination.id);
      if (!endpoint) return;
      const active = hoveredId === destination.id;
      const dimmed = Boolean(hoveredId && !active);
      ctx.beginPath();
      ctx.arc(endpoint.x, endpoint.y, active ? 4 : 2.7, 0, Math.PI * 2);
      ctx.fillStyle = destination.color;
      ctx.globalAlpha = active ? 0.95 : dimmed ? 0.25 : 0.64;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.beginPath();
    ctx.arc(tree.center.x, tree.center.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = hoveredId ? 'rgba(228, 249, 250, 0.82)' : 'rgba(212, 232, 232, 0.58)';
    ctx.fill();
  }, [dimensions, hoveredId, tree]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-[#020306]"
      data-home-branch-count={BRANCH_COUNT}
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,3,6,0.32),transparent_18%,transparent_78%,rgba(2,3,6,0.72))]" />

      {tree && (
        <>
          <nav
            aria-label="Primary homepage destinations"
            className={`absolute inset-0 transition-opacity duration-200 ${isMeasured ? 'opacity-100' : 'opacity-0'}`}
          >
            {DESTINATIONS.map((destination, index) => {
              const position = labelPosition(
                destination,
                index,
                dimensions,
                tree.center,
                tree.horizontalRadius,
                tree.verticalRadius,
                tree.compact,
                tree.titleBand
              );
              const active = hoveredId === destination.id;

              return (
                <Link
                  key={destination.id}
                  href={destination.href}
                  data-dendrite-destination={destination.id}
                  aria-label={`Open ${destination.label}`}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.08em] backdrop-blur-md transition-all duration-200 sm:px-3.5 sm:py-2.5 sm:text-xs lg:text-[13px] ${
                    active
                      ? 'scale-[1.04] border-cyan/45 bg-[#06141a]/90 text-cyan shadow-[0_0_30px_rgba(94,226,255,0.14)]'
                      : 'border-white/10 bg-[#03070b]/72 text-white/68 hover:border-white/25 hover:bg-[#071016]/88 hover:text-white'
                  }`}
                  style={{ ...CODE_TEXT, left: position.x, top: position.y }}
                  onMouseEnter={() => setHoveredId(destination.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(destination.id)}
                  onBlur={() => setHoveredId(null)}
                >
                  <span className="hidden min-[470px]:inline">{destination.label}</span>
                  <span className="min-[470px]:hidden">{destination.compactLabel}</span>
                </Link>
              );
            })}
          </nav>

          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: tree.center.x, top: tree.center.y }}
            aria-hidden="true"
          >
            <div className="relative h-16 w-16 sm:h-[4.6rem] sm:w-[4.6rem]">
              <div className="absolute inset-0 rotate-45 rounded-[18px] border border-white/14 bg-white/[0.035] shadow-[0_0_42px_rgba(83,211,231,0.06)]" />
              <div className="absolute inset-[14%] rotate-45 rounded-[12px] border border-cyan/10 bg-cyan/[0.025]" />
            </div>
          </div>

          <Link
            href="/about"
            className="absolute z-30 -translate-x-1/2 rounded-full border border-white/14 bg-[#03070b]/80 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/72 backdrop-blur-md transition-all hover:border-cyan/35 hover:text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/60 sm:text-[10px]"
            style={{ left: tree.center.x, top: tree.center.y + (tree.compact ? 48 : 54) }}
          >
            Core
          </Link>
        </>
      )}

      <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 text-center sm:top-6">
        <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-white/22 sm:text-[9px]">
          Sids Neural Net
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[min(92vw,92rem)] -translate-x-1/2 text-center sm:bottom-7 lg:bottom-9">
        <h1
          className="font-medium leading-none tracking-[-0.035em] text-white/92"
          style={{ ...CODE_TEXT, fontSize: 'clamp(1.65rem, 3.3vw, 3.4rem)' }}
        >
          SIDHARTH HULYALKAR
        </h1>
        <p
          className="mx-auto mt-2 max-w-[76rem] text-[9px] uppercase leading-relaxed tracking-[0.08em] text-white/36 sm:text-[10px] md:text-xs"
          style={CODE_TEXT}
        >
          NEURAL DATA SYSTEMS · MULTIMODAL MODELING · INTERPRETABILITY · SCIENTIFIC SOFTWARE
        </p>
      </div>
    </div>
  );
}
