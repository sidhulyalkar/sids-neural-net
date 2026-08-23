export const FRONTIER_FLUID_DOUBLE_MS = 250;
export const FRONTIER_FLUID_MOVE_PX = 9;
export const FRONTIER_FLUID_PRESS_MS = 650;

export type FrontierFluidIntent = 'expand' | 'collapse' | 'external' | 'none';

export type FrontierFluidClickState = {
  lastReleaseAt: number;
};

export type FrontierFluidPress = {
  pointerId: number;
  x: number;
  y: number;
  startedAt: number;
};

export type FrontierFluidReleasePoint = {
  x: number;
  y: number;
  at: number;
};

export function resolveFrontierFluidIntent(input: {
  state: FrontierFluidClickState;
  at: number;
  expanded: boolean;
  doubleMs?: number;
}): { intent: FrontierFluidIntent; state: FrontierFluidClickState } {
  const threshold = Math.max(120, Math.min(420, input.doubleMs ?? FRONTIER_FLUID_DOUBLE_MS));
  const delta = input.state.lastReleaseAt > 0 ? input.at - input.state.lastReleaseAt : Number.POSITIVE_INFINITY;
  if (delta >= 0 && delta <= threshold) {
    return { intent: 'external', state: { lastReleaseAt: 0 } };
  }
  return {
    intent: input.expanded ? 'collapse' : 'expand',
    state: { lastReleaseAt: input.at },
  };
}

/**
 * Preserve ownership of a deliberately rapid second press even if the first
 * release has already caused FLIP motion to place a different descendant under
 * the stationary pointer. Time alone is not sufficient: the press must remain
 * inside the same small spatial neighborhood, so a newly targeted control away
 * from the original release keeps its native behavior.
 */
export function qualifiesFrontierFluidPairPress(
  previous: FrontierFluidReleasePoint | undefined,
  input: { x: number; y: number; at: number; doubleMs?: number; maxDistancePx?: number },
): boolean {
  if (!previous || previous.at <= 0 || input.at < previous.at) return false;
  const threshold = Math.max(120, Math.min(420, input.doubleMs ?? FRONTIER_FLUID_DOUBLE_MS));
  const maxDistance = Math.max(3, Math.min(24, input.maxDistancePx ?? FRONTIER_FLUID_MOVE_PX));
  const delta = input.at - previous.at;
  if (delta > threshold) return false;
  const dx = input.x - previous.x;
  const dy = input.y - previous.y;
  return dx * dx + dy * dy <= maxDistance * maxDistance;
}

export function qualifiesFrontierFluidRelease(
  press: FrontierFluidPress | undefined,
  input: { pointerId: number; x: number; y: number; at: number; maxMovePx?: number; maxPressMs?: number }
): boolean {
  if (!press || press.pointerId !== input.pointerId) return false;
  const maxMove = Math.max(3, Math.min(24, input.maxMovePx ?? FRONTIER_FLUID_MOVE_PX));
  const maxPress = Math.max(180, Math.min(1_500, input.maxPressMs ?? FRONTIER_FLUID_PRESS_MS));
  const dx = input.x - press.x;
  const dy = input.y - press.y;
  return dx * dx + dy * dy <= maxMove * maxMove
    && input.at >= press.startedAt
    && input.at - press.startedAt <= maxPress;
}

export function frontierCriticalSpringProgress(t: number, omega = 9.5): number {
  const bounded = Math.max(0, Math.min(1, t));
  if (bounded === 1) return 1;
  const w = Math.max(3, Math.min(18, omega));
  const raw = 1 - (1 + w * bounded) * Math.exp(-w * bounded);
  const end = 1 - (1 + w) * Math.exp(-w);
  return Math.max(0, Math.min(1, raw / Math.max(1e-6, end)));
}

export type FrontierFlipDelta = {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
};

export function frontierFlipDelta(first: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>, last: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>): FrontierFlipDelta {
  return {
    dx: first.left - last.left,
    dy: first.top - last.top,
    sx: first.width / Math.max(1, last.width),
    sy: first.height / Math.max(1, last.height),
  };
}

export function frontierSpringTransform(delta: FrontierFlipDelta, t: number): string {
  const progress = frontierCriticalSpringProgress(t);
  const remaining = 1 - progress;
  const x = delta.dx * remaining;
  const y = delta.dy * remaining;
  const sx = 1 + (delta.sx - 1) * remaining;
  const sy = 1 + (delta.sy - 1) * remaining;
  return `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
}
