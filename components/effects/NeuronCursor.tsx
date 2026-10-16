'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Point = {
  x: number;
  y: number;
};

type ShockKind = 'primary' | 'secondary';

type CursorSnapshot = {
  enabled: boolean;
  visible: boolean;
  interactive: boolean;
  points: Point[];
  speed: number;
  excited: boolean;
  shockId: number;
  shockKind: ShockKind;
};

const HISTORY_LENGTH = 56;
const MAX_TRAIL_DISTANCE = 148;
const SHEATH_COUNT = 6;
const CURSOR_SCALE = 0.58;
const INTERACTIVE_SCALE = 0.66;
const SOMA_POINTER_OFFSET = 13;
const MIN_FRAME_DISTANCE = 0.35;
const MEDIUM_SPEED = 12;
const HIGH_SPEED = 24;

const EMPTY_SNAPSHOT: CursorSnapshot = {
  enabled: false,
  visible: false,
  interactive: false,
  points: [],
  speed: 0,
  excited: false,
  shockId: 0,
  shockKind: 'primary',
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

  const sampled = points.filter((_, index) => index % 4 === 0).slice(0, 14);
  return sampled.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path}${command}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
  }, '');
}

function capTrailByDistance(points: Point[], maxDistance: number) {
  if (points.length < 2) return points;

  const capped = [points[0]];
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);

    if (segmentLength === 0) {
      capped.push(current);
      continue;
    }

    if (distance + segmentLength > maxDistance) {
      const remaining = maxDistance - distance;
      const ratio = Math.max(0, remaining / segmentLength);

      capped.push({
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      });

      break;
    }

    capped.push(current);
    distance += segmentLength;
  }

  return capped;
}

export function NeuronCursor() {
  const pointerRef = useRef<Point | null>(null);
  const historyRef = useRef<Point[]>([]);
  const interactiveRef = useRef(false);
  const speedRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const renderedRef = useRef(false);
  const excitedUntilRef = useRef(0);
  const forceRenderRef = useRef(false);
  const shockIdRef = useRef(0);
  const shockKindRef = useRef<ShockKind>('primary');
  const [snapshot, setSnapshot] = useState<CursorSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    const canUseCustomCursor =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canUseCustomCursor) return undefined;

    document.documentElement.classList.add('neuron-cursor-active');
    const publishFrame = () => {
      const pointer = pointerRef.current;
      frameRef.current = null;

      if (!pointer) return;

      const history = historyRef.current;
      const previous = history[0] ?? pointer;
      const distance = Math.hypot(pointer.x - previous.x, pointer.y - previous.y);
      const shouldForceRender = forceRenderRef.current;

      if (renderedRef.current && distance < MIN_FRAME_DISTANCE && !shouldForceRender) return;

      speedRef.current = speedRef.current * 0.5 + distance * 0.5;
      forceRenderRef.current = false;
      historyRef.current = [pointer, ...history].slice(0, HISTORY_LENGTH);
      renderedRef.current = true;
      setSnapshot({
        enabled: true,
        visible: true,
        interactive: interactiveRef.current,
        points: historyRef.current,
        speed: speedRef.current,
        excited: window.performance.now() < excitedUntilRef.current,
        shockId: shockIdRef.current,
        shockKind: shockKindRef.current,
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

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      pointerRef.current = { x: event.clientX, y: event.clientY };
      excitedUntilRef.current = window.performance.now() + 360;
      shockIdRef.current += 1;
      shockKindRef.current = event.button === 2 ? 'secondary' : 'primary';
      forceRenderRef.current = true;
      requestFrame();

      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }

      clickTimerRef.current = window.setTimeout(() => {
        forceRenderRef.current = true;
        requestFrame();
      }, 380);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      document.documentElement.classList.remove('neuron-cursor-active');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }

      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const activePoints = useMemo(
    () => capTrailByDistance(snapshot.points, MAX_TRAIL_DISTANCE),
    [snapshot.points]
  );
  const cursorPath = useMemo(() => buildPath(activePoints), [activePoints]);

  if (!snapshot.enabled || snapshot.points.length === 0) return null;

  const head = pointAt(activePoints, 0);
  const bodyScale = snapshot.interactive ? INTERACTIVE_SCALE : CURSOR_SCALE;
  const isExcited = snapshot.excited;
  const isSecondaryShock = snapshot.shockKind === 'secondary';
  const shockGlowFilter = isSecondaryShock
    ? 'url(#neuron-cursor-electric-glow-secondary)'
    : 'url(#neuron-cursor-electric-glow)';
  const shockHaloStroke = isSecondaryShock ? 'rgba(167,139,250,0.5)' : 'rgba(247,198,107,0.46)';
  const shockGradient = isSecondaryShock
    ? 'url(#neuron-cursor-shock-secondary)'
    : 'url(#neuron-cursor-shock)';
  const shockSparkStroke = isSecondaryShock ? 'rgba(255,190,245,0.98)' : 'rgba(255,255,255,0.96)';
  const somaScale = bodyScale + (isExcited ? 0.06 : 0);
  const directionPoint = pointAt(activePoints, 1);
  const movementDistance = Math.hypot(head.x - directionPoint.x, head.y - directionPoint.y);
  const movementAngle = Math.atan2(head.y - directionPoint.y, head.x - directionPoint.x);
  const somaOffset = movementDistance > 0.75 ? SOMA_POINTER_OFFSET * somaScale : 0;
  const somaX = head.x - Math.cos(movementAngle) * somaOffset;
  const somaY = head.y - Math.sin(movementAngle) * somaOffset;
  const trailOpacity = snapshot.visible ? 1 : 0;
  const isHighSpeed = snapshot.speed > HIGH_SPEED;
  const desiredSheathCount = isHighSpeed ? 3 : snapshot.speed > MEDIUM_SPEED ? 4 : SHEATH_COUNT;
  const activeSheathCount = Math.min(
    desiredSheathCount,
    Math.max(0, Math.floor((activePoints.length - 1) / 3))
  );

  const sheathSegments = Array.from({ length: activeSheathCount }, (_, index) => {
    const trailSpan = Math.max(1, activePoints.length - 1);
    const pointIndex = Math.round(((index + 1) / (activeSheathCount + 1)) * trailSpan);
    const point = pointAt(activePoints, pointIndex);
    const next = pointAt(activePoints, Math.min(trailSpan, pointIndex + 1));
    const angle = angleBetween(point, next);
    const fade = 1 - index / (activeSheathCount + 1);

    return {
      id: `sheath-${index}`,
      point,
      angle,
      fade,
      width: index % 2 === 0 ? 21 : 18,
    };
  });

  const terminalRoot = pointAt(activePoints, Math.max(0, activePoints.length - 4));
  const terminalNext = pointAt(activePoints, Math.max(0, activePoints.length - 2));
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
          <feGaussianBlur stdDeviation="1.45" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neuron-cursor-electric-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" result="electricBlur" />
          <feColorMatrix
            in="electricBlur"
            type="matrix"
            values="1 0 0 0 0.95  0 1 0 0 0.78  0 0 1 0 0.18  0 0 0 1 0"
            result="warmGlow"
          />
          <feMerge>
            <feMergeNode in="warmGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neuron-cursor-electric-glow-secondary" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.8" result="electricBlurSecondary" />
          <feColorMatrix
            in="electricBlurSecondary"
            type="matrix"
            values="1 0 0 0 0.58  0 1 0 0 0.24  0 0 1 0 0.92  0 0 0 1 0"
            result="violetGlow"
          />
          <feMerge>
            <feMergeNode in="violetGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="neuron-cursor-axon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(102,227,255,0.08)" />
          <stop offset="42%" stopColor="rgba(134,236,255,0.68)" />
          <stop offset="100%" stopColor="rgba(91,140,255,0.18)" />
        </linearGradient>
        <linearGradient id="neuron-cursor-shock" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.98)" />
          <stop offset="72%" stopColor="rgba(247,198,107,0.92)" />
          <stop offset="100%" stopColor="rgba(255,244,178,0.2)" />
        </linearGradient>
        <linearGradient id="neuron-cursor-shock-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="42%" stopColor="rgba(255,238,255,0.98)" />
          <stop offset="70%" stopColor="rgba(255,122,162,0.9)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0.28)" />
        </linearGradient>
      </defs>

      <path
        d={cursorPath}
        fill="none"
        stroke="url(#neuron-cursor-axon)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.35"
        filter="url(#neuron-cursor-glow)"
      />
      <path
        d={cursorPath}
        fill="none"
        stroke={isExcited ? 'rgba(225,250,255,0.72)' : 'rgba(155,238,255,0.42)'}
        strokeDasharray="1 11"
        strokeLinecap="round"
        strokeWidth={isExcited ? '5' : '4.2'}
      />

      {isExcited && cursorPath && (
        <g key={`shock-${snapshot.shockId}`} filter={shockGlowFilter}>
          <path
            d={cursorPath}
            fill="none"
            stroke={shockHaloStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
            strokeDasharray="18 92"
            strokeDashoffset="112"
          >
            <animate attributeName="stroke-dashoffset" values="112;0;-88" dur="360ms" repeatCount="1" />
            <animate attributeName="opacity" values="0;0.9;0.72;0" dur="360ms" repeatCount="1" fill="freeze" />
          </path>
          <path
            d={cursorPath}
            fill="none"
            stroke={shockGradient}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4.2"
            strokeDasharray="10 34 2 18"
            strokeDashoffset="64"
          >
            <animate attributeName="stroke-dashoffset" values="64;0;-74" dur="320ms" repeatCount="1" />
            <animate attributeName="opacity" values="0;1;0.88;0" dur="360ms" repeatCount="1" fill="freeze" />
          </path>
          <path
            d={cursorPath}
            fill="none"
            stroke={shockSparkStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            strokeDasharray="2 18"
            strokeDashoffset="38"
          >
            <animate attributeName="stroke-dashoffset" values="38;0;-42" dur="260ms" repeatCount="1" />
            <animate attributeName="opacity" values="0;1;0.65;0" dur="300ms" repeatCount="1" fill="freeze" />
          </path>
        </g>
      )}

      {sheathSegments.map((segment) => (
        <g
          key={segment.id}
          opacity={(isExcited ? 0.18 : 0) + 0.28 + segment.fade * 0.54}
          transform={`translate(${segment.point.x.toFixed(1)} ${segment.point.y.toFixed(1)}) rotate(${segment.angle.toFixed(1)})`}
        >
          <rect
            x={-segment.width / 2}
            y="-5.5"
            width={segment.width}
            height="11"
            rx="5.5"
            fill="rgba(102,227,255,0.26)"
            stroke="rgba(205,245,255,0.44)"
            strokeWidth="1"
          />
          <rect
            x={-segment.width / 2 + 4}
            y="-3.6"
            width={segment.width - 8}
            height="7.2"
            rx="3.6"
            fill="rgba(134,236,255,0.18)"
          />
        </g>
      ))}

      {!isHighSpeed && (
        <g
          opacity="0.72"
          transform={`translate(${terminalRoot.x.toFixed(1)} ${terminalRoot.y.toFixed(1)}) rotate(${terminalAngle.toFixed(1)})`}
          filter="url(#neuron-cursor-glow)"
        >
          <path
            d="M0 0 C8 -7 16 -9 23 -17 M0 0 C9 1 17 5 24 12 M0 0 C10 -2 20 -1 29 1"
            fill="none"
            stroke="rgba(134,236,255,0.76)"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <circle cx="23" cy="-17" r="2.1" fill="rgba(134,236,255,0.84)" />
          <circle cx="24" cy="12" r="2.1" fill="rgba(134,236,255,0.84)" />
          <circle cx="29" cy="1" r="1.9" fill="rgba(134,236,255,0.84)" />
        </g>
      )}

      <g
        className="neuron-cursor-soma"
        transform={`translate(${somaX.toFixed(1)} ${somaY.toFixed(1)}) scale(${somaScale})`}
        filter="url(#neuron-cursor-glow)"
      >
        <path
          d="M-7 -8 C-17 -17 -22 -18 -31 -13 M-9 -4 C-23 -5 -27 -2 -37 6 M-8 6 C-18 13 -19 19 -26 26 M4 -9 C9 -21 16 -25 18 -35 M8 -4 C21 -11 29 -10 39 -16 M8 5 C20 11 25 17 31 29"
          fill="none"
          stroke={isExcited ? 'rgba(225,250,255,0.96)' : 'rgba(134,236,255,0.82)'}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M-22 -18 C-25 -26 -24 -31 -20 -37 M-29 -12 C-38 -14 -42 -18 -47 -25 M-32 6 C-41 10 -44 15 -48 22 M-24 26 C-27 34 -32 39 -39 43 M18 -35 C24 -42 25 -47 25 -54 M39 -16 C47 -21 54 -20 60 -18 M31 29 C34 38 40 42 48 45"
          fill="none"
          stroke={isExcited ? 'rgba(175,244,255,0.72)' : 'rgba(134,236,255,0.46)'}
          strokeLinecap="round"
          strokeWidth="1.45"
        />
        <path
          d="M-9 -10 C-1 -18 13 -13 17 -2 C21 10 11 19 -2 18 C-16 17 -22 1 -9 -10Z"
          fill={isExcited ? 'rgba(225,250,255,0.94)' : 'rgba(134,236,255,0.88)'}
          stroke={isExcited ? 'rgba(255,255,255,0.92)' : 'rgba(225,250,255,0.78)'}
          strokeWidth="1.2"
        />
        <path
          d="M0 -6 C6 -8 12 -3 12 4 C12 10 7 14 1 13 C-6 12 -10 7 -9 1 C-8 -3 -5 -5 0 -6Z"
          fill={isExcited ? 'rgba(91,140,255,0.94)' : 'rgba(71,105,209,0.86)'}
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
