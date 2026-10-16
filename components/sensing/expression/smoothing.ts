import { EXPRESSION_SIGNALS, type ExpressionReading } from './types';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothReading(previous: ExpressionReading, next: ExpressionReading, alpha = 0.22): ExpressionReading {
  const t = clamp(alpha);
  const signals = { ...previous.signals };
  for (const signal of EXPRESSION_SIGNALS) signals[signal] = lerp(previous.signals[signal], next.signals[signal], t);
  return {
    signals,
    intensity: lerp(previous.intensity, next.intensity, t),
    head: {
      yaw: lerp(previous.head.yaw, next.head.yaw, t),
      pitch: lerp(previous.head.pitch, next.head.pitch, t),
      roll: lerp(previous.head.roll, next.head.roll, t),
    },
  };
}
