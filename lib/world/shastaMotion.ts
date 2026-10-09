import type { Point } from "./model";

export const SHASTA_MOTION = {
  targetResponse: 6.2,
  acceleration: 8.5,
  braking: 12,
  minCruiseSpeed: 3.4,
  maxCruiseSpeed: 20,
  leaderSpeedBonus: 1.8,
  stopDistance: 0.85,
  arrivalDistance: 4.8,
  headingResponse: 8,
  maxTurnRate: 3.4,
} as const;

const clampDt = (dt: number) => Math.max(0, Math.min(dt, 0.1));
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function smoothstep(value: number, low: number, high: number) {
  if (high <= low) return value >= high ? 1 : 0;
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smoothingAlpha(dt: number, response: number) {
  return 1 - Math.exp(-clampDt(dt) * response);
}

export function smoothPoint(
  current: Point,
  target: Point,
  dt: number,
  response = SHASTA_MOTION.targetResponse,
): Point {
  const alpha = smoothingAlpha(dt, response);
  return {
    x: current.x + (target.x - current.x) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

export function steerShastaVelocity(
  velocity: Point,
  point: Point,
  target: Point,
  leaderSpeed: number,
  dt: number,
): Point {
  const stepDt = clampDt(dt);
  const dx = target.x - point.x;
  const dz = target.z - point.z;
  const targetDistance = Math.hypot(dx, dz);
  const currentSpeed = Math.hypot(velocity.x, velocity.z);
  const cruiseSpeed = clamp(
    leaderSpeed + SHASTA_MOTION.leaderSpeedBonus,
    SHASTA_MOTION.minCruiseSpeed,
    SHASTA_MOTION.maxCruiseSpeed,
  );
  const arrival = smoothstep(
    targetDistance,
    SHASTA_MOTION.stopDistance,
    SHASTA_MOTION.arrivalDistance,
  );
  const desiredSpeed = cruiseSpeed * arrival;
  const inverseDistance = targetDistance > 1e-6 ? 1 / targetDistance : 0;
  const desired = {
    x: dx * inverseDistance * desiredSpeed,
    z: dz * inverseDistance * desiredSpeed,
  };
  const deltaX = desired.x - velocity.x;
  const deltaZ = desired.z - velocity.z;
  const deltaLength = Math.hypot(deltaX, deltaZ);
  const rate =
    desiredSpeed > currentSpeed
      ? SHASTA_MOTION.acceleration
      : SHASTA_MOTION.braking;
  const maxDelta = rate * stepDt;
  const scale =
    deltaLength > maxDelta && deltaLength > 1e-6 ? maxDelta / deltaLength : 1;
  return {
    x: velocity.x + deltaX * scale,
    z: velocity.z + deltaZ * scale,
  };
}

export function smoothAngle(
  current: number,
  target: number,
  dt: number,
): number {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  const eased = delta * smoothingAlpha(dt, SHASTA_MOTION.headingResponse);
  const maxStep = SHASTA_MOTION.maxTurnRate * clampDt(dt);
  const applied = clamp(eased, -maxStep, maxStep);
  const next = current + applied;
  return Math.atan2(Math.sin(next), Math.cos(next));
}

export function gaitBlendForSpeed(speed: number) {
  return smoothstep(speed, 0.12, 2.2);
}

export type ChaseState = {
  mode: "follow" | "chase" | "return";
  target: number | null;
  until: number;
  cooldown: number;
};
export const initialChaseState = (): ChaseState => ({
  mode: "follow",
  target: null,
  until: 0,
  cooldown: 0,
});
/** Return is committed until reunion: moving prey cannot perpetually retarget the dog. */
export function stepChase(
  state: ChaseState,
  now: number,
  dog: Point,
  player: Point,
  prey: readonly Point[],
  allowed: boolean,
): ChaseState {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
  if (!allowed)
    return { mode: "return", target: null, until: 0, cooldown: now + 10 };
  if (state.mode === "chase") {
    const target = state.target === null ? undefined : prey[state.target];
    if (
      !target ||
      now >= state.until ||
      d(dog, player) > 12 ||
      d(target, player) > 14 ||
      d(dog, target) < 1.2
    )
      return { mode: "return", target: null, until: 0, cooldown: now + 10 };
    return state;
  }
  if (state.mode === "return")
    return d(dog, player) < 4.5
      ? {
          ...state,
          mode: "follow",
          cooldown: Math.max(state.cooldown, now + 6),
        }
      : state;
  if (d(dog, player) > 9) return { ...state, mode: "return", target: null };
  if (now < state.cooldown || d(dog, player) > 5) return state;
  const candidates = prey
    .map((p, i) => ({ i, d: d(dog, p), p }))
    .filter((x) => x.d < 8 && d(x.p, player) < 9)
    .sort((a, b) => a.d - b.d);
  return candidates.length
    ? { mode: "chase", target: candidates[0].i, until: now + 3.5, cooldown: 0 }
    : state;
}

/** A persistent detour side prevents head-on trunk deadlocks without teleporting. */
export function shastaDetour(
  point: Point,
  target: Point,
  obstacles: readonly (Point & { radius: number })[],
  side: number,
): Point {
  const dx = target.x - point.x,
    dz = target.z - point.z,
    len = Math.hypot(dx, dz);
  if (len < 0.01) return target;
  const fx = dx / len,
    fz = dz / len;
  let best: (typeof obstacles)[number] | undefined,
    nearest = Infinity;
  for (const o of obstacles) {
    const along = (o.x - point.x) * fx + (o.z - point.z) * fz;
    if (along < 0 || along > Math.min(4, len)) continue;
    const lateral = Math.abs((o.x - point.x) * fz - (o.z - point.z) * fx);
    if (lateral < o.radius + 0.85 && along < nearest) {
      best = o;
      nearest = along;
    }
  }
  if (!best) return target;
  const r = best.radius + 1.15;
  return {
    x: best.x + fz * r * side + fx * 0.8,
    z: best.z - fx * r * side + fz * 0.8,
  };
}
