import { WORLD3D_STANDARDS } from './standards';
import { resolvePlayerMotion, type PlayerCapsule, DEFAULT_PLAYER_CAPSULE } from './collision';
import { buildWorldNavigationGeometry, hasPlayerClearance } from './navigation';
import type { Vec3, World3DPlan } from './types';

export type LocomotionMode = 'teleport' | 'smooth';

export type TeleportResult = {
  valid: boolean;
  position: Vec3;
  reason?: 'off-navigation' | 'blocked' | 'too-steep' | 'outside-world';
};

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

export function validateTeleportTarget(plan: World3DPlan, target: Vec3, capsule: PlayerCapsule = DEFAULT_PLAYER_CAPSULE): TeleportResult {
  if (Math.hypot(target[0], target[2]) > plan.radius * 0.96) return { valid: false, position: target, reason: 'outside-world' };

  const geometry = buildWorldNavigationGeometry(plan);
  let nearest = geometry.teleportPoints[0];
  let nearestDistance = nearest ? horizontalDistance(target, nearest.position) : Number.POSITIVE_INFINITY;
  for (const point of geometry.teleportPoints.slice(1)) {
    const d = horizontalDistance(target, point.position);
    if (d < nearestDistance) {
      nearest = point;
      nearestDistance = d;
    }
  }
  if (!nearest || nearestDistance > Math.max(0.9, nearest.width * 0.55)) return { valid: false, position: target, reason: 'off-navigation' };

  const corridor = geometry.corridors.find((entry) => entry.connection.id === nearest.connectionId);
  if (corridor && corridor.connection.kind !== 'portal' && corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees) {
    return { valid: false, position: nearest.position, reason: 'too-steep' };
  }

  const snapped: Vec3 = [nearest.position[0], nearest.position[1], nearest.position[2]];
  if (!hasPlayerClearance(plan, snapped, capsule.radius)) return { valid: false, position: snapped, reason: 'blocked' };
  return { valid: true, position: snapped };
}

export function smoothLocomotionStep(
  plan: World3DPlan,
  current: Vec3,
  forward: Vec3,
  right: Vec3,
  input: { forward: number; strafe: number; speedMetersPerSecond: number; deltaSeconds: number },
  capsule: PlayerCapsule = DEFAULT_PLAYER_CAPSULE,
) {
  const speed = Math.min(2.4, Math.max(0, input.speedMetersPerSecond));
  const dt = Math.min(0.05, Math.max(0, input.deltaSeconds));
  const desired: Vec3 = [
    current[0] + (forward[0] * input.forward + right[0] * input.strafe) * speed * dt,
    current[1],
    current[2] + (forward[2] * input.forward + right[2] * input.strafe) * speed * dt,
  ];
  if (Math.hypot(desired[0], desired[2]) > plan.radius * 0.96) return { position: current, hits: [], blocked: true };
  return resolvePlayerMotion(plan, current, desired, capsule);
}

export function snapTurn(currentYawRadians: number, direction: -1 | 1, incrementDegrees = 30): number {
  const increment = Math.max(15, Math.min(45, incrementDegrees)) * (Math.PI / 180);
  const next = currentYawRadians + direction * increment;
  return Math.atan2(Math.sin(next), Math.cos(next));
}
