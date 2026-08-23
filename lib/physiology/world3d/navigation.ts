import { WORLD3D_STANDARDS } from './standards';
import type { Vec3, World3DConnection, World3DPlan, World3DPrimitive } from './types';

export type NavigationPoint = {
  position: Vec3;
  connectionId: string;
  t: number;
  width: number;
  laneOffset: number;
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

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function slopeDegrees(a: Vec3, b: Vec3): number {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (horizontal <= 1e-6) return Math.abs(b[1] - a[1]) > 1e-6 ? 90 : 0;
  return Math.atan2(Math.abs(b[1] - a[1]), horizontal) * (180 / Math.PI);
}

function anchorMap(plan: World3DPlan) {
  return new Map(plan.anchors.map((anchor) => [anchor.id, anchor]));
}

/**
 * Produce a deterministic ladder of lane and shoulder offsets. The authored
 * connection width remains the preferred walking lane. Wider offsets are
 * collision-avoidance shoulders used only when dense generated geometry blocks
 * the direct route. Every resulting station is independently clearance-tested.
 */
function navigationOffsets(connection: World3DConnection, worldRadius: number) {
  if (connection.kind === 'portal') return [0];
  const usableHalfWidth = Math.max(0.18, connection.width * 0.5 - 0.42);
  const offsets = [0, -usableHalfWidth * 0.45, usableHalfWidth * 0.45, -usableHalfWidth * 0.9, usableHalfWidth * 0.9];
  const maximumShoulder = Math.min(5.6, Math.max(2.4, worldRadius * 0.42));
  for (let offset = usableHalfWidth + 0.55; offset <= maximumShoulder + 1e-6; offset += 0.55) offsets.push(-offset, offset);
  return offsets;
}

function corridorPoint(from: Vec3, to: Vec3, t: number, laneOffset: number): Vec3 {
  const center = lerp(from, to, t);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const horizontalLength = Math.hypot(dx, dz);
  if (horizontalLength <= 1e-6 || laneOffset === 0) return center;
  const normalX = -dz / horizontalLength;
  const normalZ = dx / horizontalLength;
  return [center[0] + normalX * laneOffset, center[1], center[2] + normalZ * laneOffset];
}

function insideWorld(plan: World3DPlan, position: Vec3) {
  return Math.hypot(position[0], position[2]) <= plan.radius * 0.92;
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
    const samples = Math.max(3, Math.ceil(length / 0.48));
    const offsets = navigationOffsets(connection, plan.radius);
    const points: NavigationPoint[] = [];

    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      for (const laneOffset of offsets) {
        const position = corridorPoint(from, to, t, laneOffset);
        if (!insideWorld(plan, position)) continue;
        points.push({ position, connectionId: connection.id, t, width: connection.width, laneOffset });
      }
    }

    const corridor = { connection, from, to, length, slopeDegrees: slopeDegrees(from, to), points };
    corridors.push(corridor);
    teleportPoints.push(...points);
  }

  const deduped = new Map<string, NavigationPoint>();
  for (const point of teleportPoints) {
    const key = `${Math.round(point.position[0] * 10)}:${Math.round(point.position[1] * 10)}:${Math.round(point.position[2] * 10)}`;
    const existing = deduped.get(key);
    if (!existing || Math.abs(point.laneOffset) < Math.abs(existing.laneOffset)) deduped.set(key, point);
  }

  return { corridors, teleportPoints: [...deduped.values()] };
}

function horizontalRadius(structure: World3DPrimitive): number {
  if (structure.kind === 'column' || structure.kind === 'spire' || structure.kind === 'crystal') return Math.max(structure.scale[0], structure.scale[2]) * 0.42;
  return Math.max(structure.scale[0], structure.scale[2]) * 0.5;
}

function orientedBoxClearance(position: Vec3, structure: World3DPrimitive): number {
  const dx = position[0] - structure.position[0];
  const dz = position[2] - structure.position[2];
  const yaw = structure.rotation[1] ?? 0;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const localX = dx * cosine + dz * sine;
  const localZ = -dx * sine + dz * cosine;
  const qx = Math.abs(localX) - structure.scale[0] * 0.5;
  const qz = Math.abs(localZ) - structure.scale[2] * 0.5;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return outside + inside;
}

export function structureBlocksPlayer(structure: World3DPrimitive): boolean {
  return structure.collision === 'solid' || structure.collision === 'interaction';
}

/**
 * Signed horizontal distance to the authored collision footprint. Thin walls
 * and slabs are treated as rotated rectangles instead of giant bounding
 * circles, which preserves actual maze gaps and canyon lanes in the XR audit.
 */
export function clearanceFromStructure(position: Vec3, structure: World3DPrimitive): number {
  if (structure.kind === 'slab' || structure.kind === 'shard' || structure.kind === 'arch') return orientedBoxClearance(position, structure);
  const dx = position[0] - structure.position[0];
  const dz = position[2] - structure.position[2];
  return Math.hypot(dx, dz) - horizontalRadius(structure);
}

export function hasPlayerClearance(plan: World3DPlan, position: Vec3, radius = 0.32): boolean {
  const required = radius + 0.08;
  return plan.structures.every(
    (structure) => !structureBlocksPlayer(structure) || structure.id === 'landmark' || clearanceFromStructure(position, structure) >= required,
  );
}

export function findSafeSpawnPosition(plan: World3DPlan, radius = WORLD3D_STANDARDS.spawnClearRadius): Vec3 | null {
  const spawn = plan.anchors.find((anchor) => anchor.role === 'spawn');
  if (!spawn) return null;
  if (hasPlayerClearance(plan, spawn.position, radius)) return [...spawn.position];

  const maximumDistance = Math.min(plan.radius * 0.78, 9.5);
  const ringSpacing = 0.32;
  const rings = Math.ceil(maximumDistance / ringSpacing);
  for (let ring = 1; ring <= rings; ring += 1) {
    const distanceFromSpawn = ring * ringSpacing;
    const samples = 16 + Math.min(36, ring * 2);
    for (let index = 0; index < samples; index += 1) {
      const angle = (index / samples) * Math.PI * 2 + ring * 0.317;
      const candidate: Vec3 = [
        spawn.position[0] + Math.cos(angle) * distanceFromSpawn,
        spawn.position[1],
        spawn.position[2] + Math.sin(angle) * distanceFromSpawn,
      ];
      if (!insideWorld(plan, candidate)) continue;
      if (hasPlayerClearance(plan, candidate, radius)) return candidate;
    }
  }

  const nearestLane = validTeleportPoints(plan)
    .filter((point) => hasPlayerClearance(plan, point.position, radius))
    .sort((a, b) => horizontalDistance(a.position, spawn.position) - horizontalDistance(b.position, spawn.position))[0];
  return nearestLane ? [...nearestLane.position] : null;
}

export function isTeleportPointValid(plan: World3DPlan, point: NavigationPoint): boolean {
  if (point.width < WORLD3D_STANDARDS.minimumWalkableWidth) return false;
  const corridor = buildWorldNavigationGeometry(plan).corridors.find((entry) => entry.connection.id === point.connectionId);
  if (corridor && corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees && corridor.connection.kind !== 'portal') return false;
  return insideWorld(plan, point.position) && hasPlayerClearance(plan, point.position);
}

export function validTeleportPoints(plan: World3DPlan): NavigationPoint[] {
  const geometry = buildWorldNavigationGeometry(plan);
  const corridors = new Map(geometry.corridors.map((entry) => [entry.connection.id, entry]));
  return geometry.teleportPoints.filter((point) => {
    const corridor = corridors.get(point.connectionId);
    if (!corridor) return false;
    if (corridor.connection.kind === 'portal') return insideWorld(plan, point.position) && hasPlayerClearance(plan, point.position);
    if (corridor.slopeDegrees > WORLD3D_STANDARDS.maximumWalkSlopeDegrees) return false;
    return insideWorld(plan, point.position) && hasPlayerClearance(plan, point.position);
  });
}
