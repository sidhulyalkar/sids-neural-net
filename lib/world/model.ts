/** Small, deterministic geography shared by the renderer, navigation and tests. */
export type RegionId = "grove" | "mountain" | "neural" | "coast" | "waterfall" | "canyon" | "cavern";
export type Point = { x: number; z: number };

export const REGIONS: {
  id: RegionId;
  name: string;
  meaning: string;
  point: Point;
  href: string;
}[] = [
  { id: "grove", name: "Redwood grove", meaning: "A little about me", point: { x: 0, z: 8 }, href: "/about" },
  { id: "mountain", name: "Granite ridge", meaning: "Things I build", point: { x: 8, z: -54 }, href: "/projects" },
  { id: "neural", name: "Strange grove", meaning: "Things I explore", point: { x: 30, z: -5 }, href: "/ideas" },
  { id: "coast", name: "Wild coast", meaning: "Life outside the screen", point: { x: -29, z: 13 }, href: "/photography" },
  { id: "waterfall", name: "Fern falls", meaning: "Follow the water", point: { x: -20, z: -24 }, href: "/photography" },
  { id: "canyon", name: "Moss canyon", meaning: "A quieter trail", point: { x: 29, z: 34 }, href: "/about" },
  { id: "cavern", name: "Arcade cavern", meaning: "Play my games", point: { x: 44, z: -9 }, href: "/arcade" },
];

export const WORLD_BOUNDS = { minX: -92, maxX: 72, minZ: -96, maxZ: 58 } as const;
export const SEA_SURFACE = -1.4;

export const MEMORY_POINTS = [
  { id: "lake", photoId: "photo-001", title: "Higher ground", point: { x: 1, z: -66 } },
  { id: "shore", photoId: "photo-028", title: "The last light", point: { x: -32, z: 8 } },
  { id: "wildflowers", photoId: "photo-038", title: "Along the coast", point: { x: -27, z: 22 } },
] as const;

export const SECRET = { x: 18, z: 22 };
export const SPAWN = { x: 0, z: 16 };

export function terrainHeight(x: number, z: number): number {
  const main = 17.5 * Math.exp(-((x - 7) ** 2 / 560 + (z + 61) ** 2 / 650));
  const westPeak = 9.2 * Math.exp(-((x + 19) ** 2 / 520 + (z + 69) ** 2 / 470));
  const shoulder = 5.4 * Math.exp(-((x - 4) ** 2 / 720 + (z + 36) ** 2 / 620));
  const canyonRise = 2.2 * Math.exp(-((x - 31) ** 2 / 500 + (z - 24) ** 2 / 850));
  return 0.65 + main + westPeak + shoulder + canyonRise +
    Math.sin(x * 0.085) * 0.42 + Math.cos(z * 0.105) * 0.5;
}

export function coastlineX(z: number): number {
  return -34 + Math.sin(z * 0.075) * 1.7 + Math.sin(z * 0.021 + 1.8) * 0.8;
}

export function isWater(point: Point): boolean {
  return point.x < coastlineX(point.z) - 0.35;
}

export function seaFloorHeight(x: number, z: number): number {
  const offshore = Math.max(0, coastlineX(z) - x);
  const shelf = SEA_SURFACE - 2.1 - Math.min(8.5, offshore * 0.15);
  const rockyRelief = Math.sin(z * 0.16) * 0.45 + Math.cos(x * 0.11) * 0.35;
  const reefRise = 1.4 * Math.exp(-((x + 55) ** 2 / 210 + (z - 10) ** 2 / 420));
  return shelf + rockyRelief + reefRise;
}

export function worldFloorHeight(x: number, z: number): number {
  return isWater({ x, z }) ? seaFloorHeight(x, z) : terrainHeight(x, z);
}

export function maxDiveDepth(point: Point): number {
  if (!isWater(point)) return 0;
  return Math.max(0, Math.min(10, SEA_SURFACE - seaFloorHeight(point.x, point.z) - 1.15));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function nearestRegion(point: Point): RegionId {
  return REGIONS.reduce((a, b) =>
    distance(point, a.point) < distance(point, b.point) ? a : b,
  ).id;
}

export function nearbyDiscovery(point: Point): string | null {
  if (distance(point, SECRET) < 3.5) return "secret";
  const memory = MEMORY_POINTS.find((m) => distance(point, m.point) < 3.2);
  if (memory) return memory.id;
  const region = REGIONS.find((r) => distance(point, r.point) < 6);
  return region?.id ?? null;
}

export type Obstacle = Point & { radius: number };

const clampToWorld = (p: Point): Point => ({
  x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, p.x)),
  z: Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, p.z)),
});

export function constrainMove(from: Point, to: Point, obstacles: Obstacle[]): Point {
  let position = clampToWorld(from);
  let target = clampToWorld(to);
  for (let iteration = 0; iteration < 4; iteration++) {
    const dx = target.x - position.x, dz = target.z - position.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 1e-12) break;
    let hitTime = 1;
    let hit: Obstacle | undefined;
    for (const obstacle of obstacles) {
      const ox = position.x - obstacle.x, oz = position.z - obstacle.z;
      const radius = obstacle.radius + 0.45;
      const projection = ox * dx + oz * dz;
      if (projection >= 0) continue;
      const discriminant = projection * projection - lengthSquared *
        (ox * ox + oz * oz - radius * radius);
      if (discriminant < 0) continue;
      const time = Math.max(0, (-projection - Math.sqrt(discriminant)) / lengthSquared);
      if (time < hitTime) { hitTime = time; hit = obstacle; }
    }
    if (!hit) return target;
    const safeTime = Math.max(0, hitTime - 1e-6 / Math.sqrt(lengthSquared));
    position = { x: position.x + dx * safeTime, z: position.z + dz * safeTime };
    const radius = distance(position, hit);
    if (radius < 1e-9) break;
    const nx = (position.x - hit.x) / radius, nz = (position.z - hit.z) / radius;
    const remainingX = dx * (1 - safeTime), remainingZ = dz * (1 - safeTime);
    const inward = Math.min(0, remainingX * nx + remainingZ * nz);
    target = clampToWorld({
      x: position.x + remainingX - inward * nx,
      z: position.z + remainingZ - inward * nz,
    });
  }
  return position;
}

export type WorldProject = {
  title: string;
  summary: string;
  href: string;
  region: RegionId;
};
export type WorldPhoto = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
};
export type WorldContent = {
  projects: WorldProject[];
  photos: WorldPhoto[];
  games: { title: string; subtitle: string; href: string }[];
};
export type WorldCommand = {
  region: RegionId;
  serial: number;
  activity?: import("./activities").Activity;
};
