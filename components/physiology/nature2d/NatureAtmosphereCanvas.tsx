'use client';

import { useEffect, useRef } from 'react';
import type { RichNatureWorldDefinition } from '@/lib/physiology/natureWorldsExpanded';

type Props = {
  world: RichNatureWorldDefinition;
  pointerX: number;
  pointerY: number;
};

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(seed: number, count: number): Particle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.4 + random() * 2.8,
    speed: 0.25 + random() * 1.2,
    drift: -0.5 + random(),
    phase: random() * Math.PI * 2,
  }));
}

export function NatureAtmosphereCanvas({ world, pointerX, pointerY }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: pointerX, y: pointerY });

  useEffect(() => {
    pointerRef.current = { x: pointerX, y: pointerY };
  }, [pointerX, pointerY]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles = buildParticles(world.seed + 1949, Math.round(18 + world.scene.density * 34 + world.scene.sparkle * 22));
    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (timeMs: number) => {
      const time = timeMs / 1000;
      context.clearRect(0, 0, width, height);
      const atmosphere = world.scene.atmosphere;
      const cues = new Set(world.scene.renderCues);
      const pointer = pointerRef.current;

      if (atmosphere === 'fog' || atmosphere === 'mist') {
        const bands = atmosphere === 'fog' ? 5 : 3;
        for (let index = 0; index < bands; index += 1) {
          const y = height * (0.3 + index * 0.12);
          const offset = Math.sin(time * 0.08 + index) * width * 0.05 + pointer.x * (index + 1) * 3;
          const gradient = context.createLinearGradient(0, y, width, y);
          gradient.addColorStop(0, 'rgba(240,248,246,0)');
          gradient.addColorStop(0.28, `rgba(235,245,243,${atmosphere === 'fog' ? 0.11 : 0.065})`);
          gradient.addColorStop(0.68, `rgba(235,245,243,${atmosphere === 'fog' ? 0.08 : 0.045})`);
          gradient.addColorStop(1, 'rgba(240,248,246,0)');
          context.fillStyle = gradient;
          context.beginPath();
          context.ellipse(width * 0.5 + offset, y, width * 0.62, height * 0.08, 0, 0, Math.PI * 2);
          context.fill();
        }
      }

      if (atmosphere === 'rain' || atmosphere === 'storm') {
        context.strokeStyle = atmosphere === 'storm' ? 'rgba(205,229,245,0.34)' : 'rgba(205,229,245,0.22)';
        context.lineWidth = atmosphere === 'storm' ? 1.2 : 0.8;
        particles.forEach((particle) => {
          const travel = reducedMotion ? particle.y : (particle.y + time * particle.speed * 0.22) % 1;
          const x = particle.x * width + travel * -width * 0.08 + pointer.x * 8;
          const y = travel * height;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x - 5 - particle.size * 2, y + 18 + particle.size * 6);
          context.stroke();
        });
      } else if (atmosphere === 'snow' || atmosphere === 'frost') {
        context.fillStyle = 'rgba(245,252,255,0.74)';
        particles.forEach((particle) => {
          const travel = reducedMotion ? particle.y : (particle.y + time * particle.speed * 0.035) % 1;
          const x = particle.x * width + Math.sin(time * 0.45 + particle.phase) * 18 * particle.drift + pointer.x * 5;
          const y = travel * height;
          context.beginPath();
          context.arc(x, y, Math.max(0.8, particle.size), 0, Math.PI * 2);
          context.fill();
        });
      }

      if (atmosphere === 'glow' || cues.has('firefly') || world.scene.sparkle > 0.7) {
        particles.slice(0, Math.min(particles.length, 34)).forEach((particle, index) => {
          const phase = reducedMotion ? particle.phase : time * (0.45 + particle.speed * 0.2) + particle.phase;
          const x = particle.x * width + Math.sin(phase * 0.8) * 22 * particle.drift + pointer.x * 10;
          const y = particle.y * height + Math.cos(phase * 0.65) * 16;
          const pulse = 0.25 + Math.max(0, Math.sin(phase * 2.1)) * 0.75;
          const radius = 1.5 + particle.size * 1.9;
          const glow = context.createRadialGradient(x, y, 0, x, y, radius * 5);
          glow.addColorStop(0, `rgba(192,255,221,${0.62 * pulse})`);
          glow.addColorStop(0.2, `rgba(108,242,211,${0.26 * pulse})`);
          glow.addColorStop(1, 'rgba(80,220,205,0)');
          context.fillStyle = glow;
          context.beginPath();
          context.arc(x, y, radius * 5, 0, Math.PI * 2);
          context.fill();
          if (index % 3 === 0) {
            context.fillStyle = `rgba(235,255,245,${0.75 * pulse})`;
            context.beginPath();
            context.arc(x, y, Math.max(0.7, radius * 0.34), 0, Math.PI * 2);
            context.fill();
          }
        });
      }

      if (cues.has('stars') || world.scene.atmosphere === 'night') {
        context.fillStyle = 'rgba(245,248,255,0.72)';
        particles.slice(0, 42).forEach((particle) => {
          const twinkle = reducedMotion ? 0.7 : 0.45 + Math.sin(time * 0.8 + particle.phase) * 0.25;
          context.globalAlpha = Math.max(0.15, twinkle);
          context.beginPath();
          context.arc(particle.x * width, particle.y * height * 0.57, 0.45 + particle.size * 0.35, 0, Math.PI * 2);
          context.fill();
        });
        context.globalAlpha = 1;
      }

      if (atmosphere === 'wind') {
        context.strokeStyle = 'rgba(230,242,238,0.12)';
        context.lineWidth = 1;
        particles.slice(0, 9).forEach((particle, index) => {
          const progress = reducedMotion ? particle.x : (particle.x + time * 0.025 * particle.speed) % 1;
          const y = height * (0.25 + particle.y * 0.55);
          const x = progress * width;
          context.beginPath();
          context.moveTo(x - 24, y + Math.sin(index + time) * 4);
          context.quadraticCurveTo(x, y - 8, x + 34, y + 1);
          context.stroke();
        });
      }

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [world]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
