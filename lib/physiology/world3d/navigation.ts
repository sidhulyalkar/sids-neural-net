import { WORLD3D_STANDARDS } from './standards';
import type { Vec3, World3DConnection, World3DPlan, World3DPrimitive } from './types';

export type NavigationPoint = {
  position: Vec3;
  connectionId: string;
  t: number;
  width: number;
};

export type NavigationCorridor = {
  connection: World3DConnection;
  from: Vec3;
  to: Vec3;
  length: number;
  slopeDegrees: number;
  points: NavigationPoint[];
};

export type WorldNavigationGeometry = {
  corridors: NavigationCorridor[];
  teleportPoints: NavigationPoint[];
};

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function slopeDegrees(a: Vec3, b: Vec3): number {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (horizontal <= 1e-6) return Math.abs(b[1] - a[1]) > 1e-6 ? 90 : 0;
  return Math.atan2(Math.abs(b[1] - a[1]), horizontal) * (180 / Math.PI);
}

function anchorMap(plan: World3DPlan) {
  return new Map(plan.anchors.map((anchor) => [anchor.id, anchor]));
}

export function buildWorldNavigationGeometry(plan: World3DPlan): WorldNavigationGeometry {
  const anchors = anchorMap(plan);
  const corridors: NavigationCorridor[] = [];
  const teleportPoints: NavigationPoint[] = [];

  for (const connection of plan.connections) {
    const from = anchors.get(connection.from)?.position;
    const to = anchors.get(connection.to)?.position;
    if (!from || !to) continue;
    const length = distance(from, to);
    const samples = Math.max(2, Math.ceil(length / 0.65));
    const points = Array.from({ length: samples + 1 }, (_, index) => {
      const t = index / samples;
      return { position: lerp(from, to, t), connectionId: connection.id, t, width: connection.width };
    });
    const corridor = { connection, from, to, length, slopeDegrees: slopeDegrees(from, to), points };
    corridors.push(corridor);
    teleportPoints.push(...points);
  }

  const deduped = new Map<string, NavigationPoint>();
  for (const point of teleportPoints) {
    const key = `${Math.round(point.position[0] * 10)}:${Math.round(point.position[1] * 10)}:${Math.round(point.position[2] * 10)}`;
    deduped.set(key, point);
  }

  return { corridors, teleportPoints: [...deduped.values()] };
}

function horizontalRadius(structure: World3DPrimitive): number {
  if (structure.kind === 'column' || structure.kind === 'spire' || structure.kind === 'crystal') {
    return Math.max(structure.scale[0], structure.scale[2]) * 0.42;
  }
  return Math.max(structure.scale[0], structure.scale[2]) * 0.5;
}

export function structureBlocksPlayer(structure: World3DPrimitive): boolean {
  return structure.collision === 'solid' || structure.collision === 'interaction';
}

export function clearanceFromStructure(position: Vec3, structure: World3DPrimitive): number {
  const dx = position[0] - structure.position[0];
  const dz = position[2] - structure.position[2];
  return Math.hypot(dx, dz) - horizontalRadius(structure);
}

export function hasPlayerClearance(plan: World3DPlan, position: Vec3, radius = 0.32): boolean {
  const required = radius + 0.08;
  return plan.structures.every((structure) => !structureBlocksPlayer(structure) || structure.id === 'landmark' || clearanceFromStructure(position, structure) >= required);
}

export function isTeleportPointValid(plan: World3DPlan, point: NavigationPoint): boolean {
  if (point.width < WORLD3D_STANDARDS.minimumWalkableWidth) return false;
  const corridor = buildWorldNavigationGeometry(plan).corridors.find((entry) => entry.connection.id === point.connectionId);
  if (corridor && corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees && corridor.connection.kind !== 'portal') return false;
  return hasPlayerClearance(plan, point.position);
}

export function validTeleportPoints(plan: World3DPlan): NavigationPoint[] {
  const geometry = buildWorldNavigationGeometry(plan);
  return geometry.teleportPoints.filter((point) => {
    const corridor = geometry.corridors.find((entry) => entry.connection.id === point.connectionId);
    if (!corridor) return false;
    if (corridor.connection.kind === 'portal') return true;
    if (corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees) return false;
    return hasPlayerClearance(plan, point.position);
  });
}
