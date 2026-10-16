import type { Vec3, World3DPlan, World3DPrimitive } from './types';
import { clearanceFromStructure, structureBlocksPlayer } from './navigation';

export type PlayerCapsule = {
  radius: number;
  height: number;
};

export type CollisionHit = {
  structureId: string;
  penetration: number;
  normal: Vec3;
};

export const DEFAULT_PLAYER_CAPSULE: PlayerCapsule = { radius: 0.32, height: 1.68 };

function verticalOverlap(position: Vec3, capsule: PlayerCapsule, structure: World3DPrimitive): boolean {
  const playerMin = position[1];
  const playerMax = position[1] + capsule.height;
  const halfHeight = structure.scale[1] * 0.5;
  const structureMin = structure.position[1] - halfHeight;
  const structureMax = structure.position[1] + halfHeight;
  return playerMax > structureMin && playerMin < structureMax;
}

function hitFor(position: Vec3, capsule: PlayerCapsule, structure: World3DPrimitive): CollisionHit | null {
  if (!structureBlocksPlayer(structure) || structure.id === 'landmark') return null;
  if (!verticalOverlap(position, capsule, structure)) return null;
  const clearance = clearanceFromStructure(position, structure);
  if (clearance >= capsule.radius) return null;
  const dx = position[0] - structure.position[0];
  const dz = position[2] - structure.position[2];
  const length = Math.hypot(dx, dz) || 1;
  return {
    structureId: structure.id,
    penetration: capsule.radius - clearance,
    normal: [dx / length, 0, dz / length],
  };
}

export function collisionsAt(plan: World3DPlan, position: Vec3, capsule = DEFAULT_PLAYER_CAPSULE): CollisionHit[] {
  return plan.structures.map((structure) => hitFor(position, capsule, structure)).filter((hit): hit is CollisionHit => Boolean(hit));
}

export function resolvePlayerMotion(
  plan: World3DPlan,
  current: Vec3,
  desired: Vec3,
  capsule = DEFAULT_PLAYER_CAPSULE,
): { position: Vec3; hits: CollisionHit[]; blocked: boolean } {
  const hits = collisionsAt(plan, desired, capsule);
  if (hits.length === 0) return { position: desired, hits: [], blocked: false };

  let x = desired[0];
  let z = desired[2];
  for (const hit of hits) {
    x += hit.normal[0] * hit.penetration;
    z += hit.normal[2] * hit.penetration;
  }

  const resolved: Vec3 = [x, desired[1], z];
  const residual = collisionsAt(plan, resolved, capsule);
  if (residual.length > 0) return { position: current, hits, blocked: true };
  return { position: resolved, hits, blocked: true };
}
