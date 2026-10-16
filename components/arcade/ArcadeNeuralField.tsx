'use client';

import { useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Branch = { from: Point; to: Point; depth: number; phase: number };

function randomFactory(seed = 9137) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBranches(width: number, height: number) {
  const random = randomFactory(Math.round(width * 7 + height * 13));
  const center = { x: width / 2, y: height / 2 };
  const branches: Branch[] = [];
  const arms = width < 720 ? 9 : 15;

  const grow = (from: Point, angle: number, length: number, depth: number) => {
    if (depth > 4 || length < 18) return;
    const to = {
      x: from.x + Math.cos(angle) * length,
      y: from.y + Math.sin(angle) * length,
    };
    branches.push({ from, to, depth, phase: random() * Math.PI * 2 });
    const children = depth < 2 ? 2 : random() > 0.42 ? 2 : 1;
    for (let index = 0; index < children; index += 1) {
      const fan = children === 1 ? 0 : index === 0 ? -1 : 1;
      grow(to, angle + fan * (0.25 + random() * 0.42) + (random() - 0.5) * 0.16, length * (0.58 + random() * 0.12), depth + 1);
    }
  };

  for (let index = 0; index < arms; index += 1) {
    const angle = (index / arms) * Math.PI * 2 + (random() - 0.5) * 0.18;
    const edgeDistance = Math.hypot(width, height) * (0.16 + random() * 0.08);
    grow(center, angle, edgeDistance, 0);
  }
  return branches;
}

export function ArcadeNeuralField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let branches: Branch[] = [];
    let frame = 0;
    let pointer = { x: 0, y: 0 };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      branches = buildBranches(rect.width, rect.height);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5,
        y: (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5,
      };
    };

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
      context.save();
      if (!reducedMotion.matches) context.translate(pointer.x * -8, pointer.y * -8);

      for (const branch of branches) {
        const pulse = reducedMotion.matches ? 0.28 : 0.19 + (Math.sin(time * 0.0012 + branch.phase) + 1) * 0.08;
        const alpha = Math.max(0.035, pulse * (1 - branch.depth * 0.13));
        context.beginPath();
        context.moveTo(branch.from.x, branch.from.y);
        const mx = (branch.from.x + branch.to.x) / 2;
        const my = (branch.from.y + branch.to.y) / 2;
        const bend = (branch.depth % 2 ? -1 : 1) * 8;
        context.quadraticCurveTo(mx - bend, my + bend, branch.to.x, branch.to.y);
        context.strokeStyle = `rgba(120, 224, 255, ${alpha})`;
        context.lineWidth = Math.max(0.45, 1.7 - branch.depth * 0.29);
        context.stroke();

        if (branch.depth >= 2) {
          context.beginPath();
          context.arc(branch.to.x, branch.to.y, Math.max(0.8, 2.2 - branch.depth * 0.28), 0, Math.PI * 2);
          context.fillStyle = `rgba(216, 246, 255, ${alpha * 1.35})`;
          context.fill();
        }
      }
      context.restore();
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    draw(performance.now());

    const onMotionPreference = () => {
      cancelAnimationFrame(frame);
      draw(performance.now());
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    reducedMotion.addEventListener('change', onMotionPreference);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      reducedMotion.removeEventListener('change', onMotionPreference);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
