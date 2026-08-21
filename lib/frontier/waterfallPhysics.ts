export type WaterfallParticleState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  width: number;
  height: number;
};

export type WaterfallBounds = {
  minX: number;
  maxX: number;
  floorY: number;
};

const GRAVITY = 1_650;
const AIR_DRAG_PER_FRAME = 0.994;
const WALL_RESTITUTION = 0.34;
const FLOOR_RESTITUTION = 0.24;
const FLOOR_FRICTION_PER_FRAME = 0.8;

function frameScaled(value: number, dt: number): number {
  return Math.pow(value, dt * 60);
}

export function stepWaterfallParticle(
  particle: WaterfallParticleState,
  dtSeconds: number,
  bounds: WaterfallBounds
): WaterfallParticleState {
  const dt = Math.max(0, Math.min(0.034, dtSeconds));
  const next: WaterfallParticleState = { ...particle };

  next.vy += GRAVITY * dt;
  next.vx *= frameScaled(AIR_DRAG_PER_FRAME, dt);
  next.x += next.vx * dt;
  next.y += next.vy * dt;
  next.rotation += next.angularVelocity * dt;

  if (next.x < bounds.minX) {
    next.x = bounds.minX;
    next.vx = Math.abs(next.vx) * WALL_RESTITUTION;
    next.angularVelocity *= 0.8;
  }

  const maxLeft = Math.max(bounds.minX, bounds.maxX - next.width);
  if (next.x > maxLeft) {
    next.x = maxLeft;
    next.vx = -Math.abs(next.vx) * WALL_RESTITUTION;
    next.angularVelocity *= 0.8;
  }

  const floorTop = Math.max(0, bounds.floorY - next.height);
  if (next.y > floorTop) {
    next.y = floorTop;
    if (Math.abs(next.vy) > 46) {
      next.vy = -Math.abs(next.vy) * FLOOR_RESTITUTION;
    } else {
      next.vy = 0;
    }
    next.vx *= frameScaled(FLOOR_FRICTION_PER_FRAME, dt);
    next.angularVelocity *= frameScaled(0.84, dt);
  }

  return next;
}

export function waterfallOpacity(ageMs: number, durationMs = 1_500): number {
  if (durationMs <= 0 || ageMs >= durationMs) return 0;
  const fadeStart = Math.min(durationMs * 0.58, durationMs - 1);
  if (ageMs <= fadeStart) return 1;
  const progress = Math.min(1, Math.max(0, (ageMs - fadeStart) / (durationMs - fadeStart)));
  return Math.pow(1 - progress, 1.35);
}
