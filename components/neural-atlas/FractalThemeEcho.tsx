'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  buildAdaptiveFractalTree,
  type FractalPath,
  type Vec2,
} from '@/lib/home/fractalDendrite';
import {
  FRACTAL_THEME_EVENT,
  isCuratedFractalThemeId,
  readFractalTheme,
  rememberFractalTheme,
  type PersistedFractalTheme,
} from '@/lib/home/fractalTheme';

const ECHO_DESTINATIONS = ['frontier', 'games', 'builds', 'systems', 'contact', 'visuals', 'research', 'papers'];

type FractalThemeEchoProps = {
  variant?: 'background' | 'glyph';
};

function drawPath(ctx: CanvasRenderingContext2D, points: Vec2[], smooth: boolean) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (!smooth || points.length < 3) {
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Vec2[]) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
}

function renderEcho(
  ctx: CanvasRenderingContext2D,
  paths: FractalPath[],
  morphology: PersistedFractalTheme['morphology'],
  variant: 'background' | 'glyph'
) {
  const background = variant === 'background';
  const limit = background ? 360 : 78;
  const smooth = !['tectonic', 'pixel-ghost', 'echo-nest'].includes(morphology);
  const chosen = paths
    .filter((path, index) => path.ownerId === '__ambient__' || path.depth <= 3 || index % 5 === 0)
    .slice(0, limit);

  for (const path of chosen) {
    if (path.renderMode === 'pixel') {
      const point = path.points[0];
      if (!point) continue;
      const size = background ? Math.max(1, path.width * 0.55) : Math.max(2.2, path.width * 0.9);
      ctx.fillStyle = background ? 'rgba(202,224,225,0.075)' : 'rgba(202,238,238,0.34)';
      ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
      continue;
    }

    if (path.renderMode === 'stencil') {
      drawPolygon(ctx, path.points);
      ctx.fillStyle = background ? 'rgba(238,240,232,0.016)' : 'rgba(238,244,236,0.075)';
      ctx.fill();
      drawPolygon(ctx, path.points);
      ctx.strokeStyle = background ? 'rgba(205,225,220,0.095)' : 'rgba(214,239,234,0.42)';
      ctx.lineWidth = background ? Math.max(0.36, path.width * 0.42) : Math.max(0.75, path.width * 0.6);
      ctx.stroke();
      continue;
    }

    drawPath(ctx, path.points, smooth);
    const depthFade = Math.max(0.22, 1 - path.depth * 0.13);
    const baseAlpha = background ? 0.085 : 0.44;
    ctx.strokeStyle = morphology === 'tectonic'
      ? `rgba(205,225,220,${baseAlpha * depthFade})`
      : `rgba(140,210,220,${baseAlpha * depthFade})`;
    ctx.lineWidth = background
      ? Math.max(0.34, path.width * 0.34)
      : Math.max(0.7, Math.min(1.8, path.width * 0.56));
    ctx.lineCap = morphology === 'tectonic' ? 'butt' : 'round';
    ctx.lineJoin = morphology === 'tectonic' ? 'miter' : 'round';
    ctx.stroke();
  }
}

function useFractalTheme(): PersistedFractalTheme | null {
  const [theme, setTheme] = useState<PersistedFractalTheme | null>(null);

  useEffect(() => {
    const refresh = () => setTheme(readFractalTheme());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(FRACTAL_THEME_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(FRACTAL_THEME_EVENT, refresh as EventListener);
    };
  }, []);

  return theme;
}

export function FractalThemeRecorder() {
  useEffect(() => {
    let frame = 0;
    let signature = '';

    const sync = () => {
      frame = 0;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology][data-fractal-seed]');
      const morphology = root?.dataset.fractalMorphology;
      const seed = root?.dataset.fractalSeed;
      if (!seed || !isCuratedFractalThemeId(morphology)) return;
      const nextSignature = `${morphology}:${seed}`;
      if (nextSignature === signature) return;
      signature = nextSignature;
      rememberFractalTheme(morphology, seed);
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}

export function FractalThemeEcho({ variant = 'background' }: FractalThemeEchoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useFractalTheme();
  const pathname = usePathname();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let frame = 0;

    const render = () => {
      frame = 0;
      const rect = variant === 'background'
        ? { width: window.innerWidth, height: window.innerHeight }
        : parent?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, variant === 'background' ? 1.35 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!theme) return;

      const routeSeed = (pathname || 'page').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
      const virtualWidth = variant === 'background' ? width : 320;
      const virtualHeight = variant === 'background' ? height : 210;
      const tree = buildAdaptiveFractalTree(
        { width: virtualWidth, height: virtualHeight },
        `force:${theme.morphology}:${theme.seed}-echo-${routeSeed}`,
        ECHO_DESTINATIONS
      );

      if (variant === 'glyph') {
        ctx.save();
        ctx.scale(width / virtualWidth, height / virtualHeight);
        renderEcho(ctx, tree.paths, theme.morphology, variant);
        ctx.restore();
      } else {
        renderEcho(ctx, tree.paths, theme.morphology, variant);
      }
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    const observer = parent && variant === 'glyph' ? new ResizeObserver(schedule) : null;
    if (observer && parent) observer.observe(parent);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [pathname, theme, variant]);

  if (variant === 'glyph') {
    return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" data-fractal-theme-echo="glyph" />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full opacity-70"
      style={{
        maskImage: 'radial-gradient(ellipse 92% 82% at 50% 42%, black 0%, rgba(0,0,0,0.92) 58%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 92% 82% at 50% 42%, black 0%, rgba(0,0,0,0.92) 58%, transparent 100%)',
      }}
      aria-hidden="true"
      data-fractal-theme-echo="background"
      data-fractal-theme-morphology={theme?.morphology}
    />
  );
}
