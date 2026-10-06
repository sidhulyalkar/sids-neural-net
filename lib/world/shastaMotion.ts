import type { Point } from "./model";

export const SHASTA_MOTION = {
  targetResponse: 6.2,
  acceleration: 8.5,
  braking: 12,
  minCruiseSpeed: 3.4,
  maxCruiseSpeed: 9.2,
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
  const scale = deltaLength > maxDelta && deltaLength > 1e-6
    ? maxDelta / deltaLength
    : 1;
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
