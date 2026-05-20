'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Point = {
  x: number;
  y: number;
};

type CursorSnapshot = {
  enabled: boolean;
  visible: boolean;
  interactive: boolean;
  points: Point[];
};

const HISTORY_LENGTH = 72;
const SHEATH_COUNT = 7;

const EMPTY_SNAPSHOT: CursorSnapshot = {
  enabled: false,
  visible: false,
  interactive: false,
  points: [],
};

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'a, button, input, textarea, select, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
      )
    )
  );
}

function pointAt(points: Point[], index: number) {
  return points[Math.min(Math.max(index, 0), points.length - 1)] ?? points[0];
}

function angleBetween(from: Point, to: Point) {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function buildPath(points: Point[]) {
  if (points.length < 2) return '';

  const sampled = points.filter((_, index) => index % 3 === 0).slice(0, 22);
  return sampled.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path}${command}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
  }, '');
}

export function NeuronCursor() {
  const pointerRef = useRef<Point | null>(null);
  const historyRef = useRef<Point[]>([]);
  const interactiveRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<CursorSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    const canUseCustomCursor =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canUseCustomCursor) return undefined;

    document.documentElement.classList.add('neuron-cursor-active');
    setSnapshot((current) => ({ ...current, enabled: true }));

    const publishFrame = () => {
      const pointer = pointerRef.current;
      frameRef.current = null;

      if (!pointer) return;

      const history = historyRef.current;
      const previous = history[0] ?? pointer;
      const easedPoint = {
        x: previous.x + (pointer.x - previous.x) * 0.72,
        y: previous.y + (pointer.y - previous.y) * 0.72,
      };

      historyRef.current = [easedPoint, ...history].slice(0, HISTORY_LENGTH);
      setSnapshot({
        enabled: true,
        visible: true,
        interactive: interactiveRef.current,
        points: historyRef.current,
      });
    };

    const requestFrame = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(publishFrame);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }

      pointerRef.current = { x: event.clientX, y: event.clientY };
      interactiveRef.current = isInteractiveTarget(event.target);

      if (historyRef.current.length === 0) {
        historyRef.current = Array.from({ length: HISTORY_LENGTH }, () => pointerRef.current as Point);
      }

      requestFrame();
    };

    const handlePointerLeave = () => {
      leaveTimerRef.current = window.setTimeout(() => {
        setSnapshot((current) => ({ ...current, visible: false }));
      }, 80);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      document.documentElement.classList.remove('neuron-cursor-active');
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const cursorPath = useMemo(() => buildPath(snapshot.points), [snapshot.points]);

  if (!snapshot.enabled || snapshot.points.length === 0) return null;

  const head = pointAt(snapshot.points, 0);
  const bodyScale = snapshot.interactive ? 1.14 : 1;
  const trailOpacity = snapshot.visible ? 1 : 0;

  const sheathSegments = Array.from({ length: SHEATH_COUNT }, (_, index) => {
    const pointIndex = 8 + index * 7;
    const point = pointAt(snapshot.points, pointIndex);
    const next = pointAt(snapshot.points, pointIndex + 4);
    const angle = angleBetween(point, next);
    const fade = 1 - index / (SHEATH_COUNT + 1);

    return {
      id: `sheath-${index}`,
      point,
      angle,
      fade,
      width: index % 2 === 0 ? 26 : 22,
    };
  });

  const terminalRoot = pointAt(snapshot.points, 63);
  const terminalNext = pointAt(snapshot.points, 68);
  const terminalAngle = angleBetween(terminalRoot, terminalNext);

  return (
    <svg
      aria-hidden="true"
      className="neuron-cursor-overlay"
      style={{ opacity: trailOpacity }}
      width="100%"
      height="100%"
    >
      <defs>
        <filter id="neuron-cursor-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="neuron-cursor-axon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(247,198,107,0.10)" />
          <stop offset="42%" stopColor="rgba(247,198,107,0.76)" />
          <stop offset="100%" stopColor="rgba(102,227,255,0.16)" />
        </linearGradient>
      </defs>

      <path
        d={cursorPath}
        fill="none"
        stroke="url(#neuron-cursor-axon)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.1"
        filter="url(#neuron-cursor-glow)"
      />
      <path
        d={cursorPath}
        fill="none"
        stroke="rgba(247,198,107,0.52)"
        strokeDasharray="1 12"
        strokeLinecap="round"
        strokeWidth="5.5"
      />

      {sheathSegments.map((segment) => (
        <g
          key={segment.id}
          opacity={0.28 + segment.fade * 0.54}
          transform={`translate(${segment.point.x.toFixed(1)} ${segment.point.y.toFixed(1)}) rotate(${segment.angle.toFixed(1)})`}
        >
          <rect
            x={-segment.width / 2}
            y="-7"
            width={segment.width}
            height="14"
            rx="7"
            fill="rgba(102,227,255,0.28)"
            stroke="rgba(205,225,220,0.42)"
            strokeWidth="1"
          />
          <rect
            x={-segment.width / 2 + 5}
            y="-4.6"
            width={segment.width - 10}
            height="9.2"
            rx="4.6"
            fill="rgba(247,198,107,0.18)"
          />
        </g>
      ))}

      <g
        opacity="0.72"
        transform={`translate(${terminalRoot.x.toFixed(1)} ${terminalRoot.y.toFixed(1)}) rotate(${terminalAngle.toFixed(1)})`}
        filter="url(#neuron-cursor-glow)"
      >
        <path
          d="M0 0 C8 -7 16 -9 23 -17 M0 0 C9 1 17 5 24 12 M0 0 C10 -2 20 -1 29 1"
          fill="none"
          stroke="rgba(247,198,107,0.78)"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <circle cx="23" cy="-17" r="2.4" fill="rgba(247,198,107,0.88)" />
        <circle cx="24" cy="12" r="2.4" fill="rgba(247,198,107,0.88)" />
        <circle cx="29" cy="1" r="2.1" fill="rgba(247,198,107,0.88)" />
      </g>

      <g
        className="neuron-cursor-soma"
        transform={`translate(${head.x.toFixed(1)} ${head.y.toFixed(1)}) scale(${bodyScale})`}
        filter="url(#neuron-cursor-glow)"
      >
        <path
          d="M-7 -8 C-17 -17 -22 -18 -31 -13 M-9 -4 C-23 -5 -27 -2 -37 6 M-8 6 C-18 13 -19 19 -26 26 M4 -9 C9 -21 16 -25 18 -35 M8 -4 C21 -11 29 -10 39 -16 M8 5 C20 11 25 17 31 29"
          fill="none"
          stroke="rgba(247,198,107,0.86)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
        <path
          d="M-22 -18 C-25 -26 -24 -31 -20 -37 M-29 -12 C-38 -14 -42 -18 -47 -25 M-32 6 C-41 10 -44 15 -48 22 M-24 26 C-27 34 -32 39 -39 43 M18 -35 C24 -42 25 -47 25 -54 M39 -16 C47 -21 54 -20 60 -18 M31 29 C34 38 40 42 48 45"
          fill="none"
          stroke="rgba(247,198,107,0.54)"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <path
          d="M-9 -10 C-1 -18 13 -13 17 -2 C21 10 11 19 -2 18 C-16 17 -22 1 -9 -10Z"
          fill="rgba(247,198,107,0.96)"
          stroke="rgba(255,236,182,0.82)"
          strokeWidth="1.2"
        />
        <path
          d="M0 -6 C6 -8 12 -3 12 4 C12 10 7 14 1 13 C-6 12 -10 7 -9 1 C-8 -3 -5 -5 0 -6Z"
          fill="rgba(167,23,124,0.86)"
        />
        <path
          d="M8 -5 C12 -2 14 3 12 8"
          fill="none"
          stroke="rgba(255,255,255,0.58)"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
