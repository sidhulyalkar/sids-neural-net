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
