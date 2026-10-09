/** Small, deterministic geography shared by the renderer, navigation and tests. */
export type RegionId = "grove" | "mountain" | "neural" | "coast" | "lagoon" | "waterfall" | "canyon" | "cavern" | "desert" | "rainforest";
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
  { id: "coast", name: "Wild coast", meaning: "Cold-water coast", point: { x: -29, z: 13 }, href: "/photography" },
  { id: "lagoon", name: "Lagoon reef", meaning: "South Pacific reef", point: { x: 58, z: 13 }, href: "/photography" },
  { id: "waterfall", name: "Fern falls", meaning: "Follow the water", point: { x: -20, z: -24 }, href: "/photography" },
  { id: "canyon", name: "Moss canyon", meaning: "A quieter trail", point: { x: 29, z: 34 }, href: "/about" },
  { id: "cavern", name: "Arcade cavern", meaning: "Play my games", point: { x: 16, z: -82 }, href: "/arcade" },
  { id: "desert", name: "Joshua basin", meaning: "Granite and desert trails", point: { x: 37, z: -29 }, href: "/photography" },
  { id: "rainforest", name: "Rainforest", meaning: "Canopy to coast", point: { x: 44, z: 33 }, href: "/photography" },
];

export const WORLD_BOUNDS = { minX: -92, maxX: 94, minZ: -96, maxZ: 58 } as const;
export const SEA_SURFACE = -1.4;

export const ARCADE_CAVE = {
  // Backside entrance of Granite Ridge. The player arrives outside and must
  // walk uphill through the tunnel before the carved game wall is selectable.
  entrance: { x: 16, z: -82 },
  approach: { x: 16, z: -86.4 },
  wall: { x: 16, z: -63 },
  tunnelHalfWidth: 3.35,
  tunnelDepth: 19,
  ceilingClearance: 4.35,
  lantern: { x: 16, z: -67.5 },
  gamePanelXs: [12.85, 16, 19.15],
} as const;

export const MEMORY_POINTS = [
  {
    id: "lake",
    photoId: "photo-001",
    title: "Mountain lake",
    detail: "Deep blue water below forest and rocky ridges.",
    point: { x: 1, z: -66 },
  },
  {
    id: "shore",
    photoId: "photo-028",
    title: "Wet beach",
    detail: "Low clouds and sunset reflected across wet sand.",
    point: { x: -32, z: 8 },
  },
  {
    id: "wildflowers",
    photoId: "photo-038",
    title: "Coastal flowers",
    detail: "Wildflowers above blue ocean cliffs.",
    point: { x: -27, z: 22 },
  },
  {
    id: "shasta-lake",
    photoId: "photo-002",
    title: "Shasta · lake",
    detail: "Shasta looking across an alpine lake.",
    point: { x: -7, z: -72 },
  },
  {
    id: "shasta-trail",
    photoId: "photo-037",
    title: "Shasta · trail",
    detail: "Shasta on a coastal trail.",
    point: { x: -24, z: 29 },
  },
  {
    id: "shasta-water",
    photoId: "photo-040",
    title: "Shasta · water",
    detail: "Shasta beside flowing water and rock.",
    point: { x: -15, z: -19 },
  },
  {
    id: "shasta-beach",
    photoId: "photo-045",
    title: "Shasta · beach",
    detail: "Shasta running across wet sand at sunset.",
    point: { x: -30, z: -3 },
  },
  {
    id: "shasta-field",
    photoId: "photo-048",
    title: "Shasta · field",
    detail: "Shasta watching cattle across a green field.",
    point: { x: 24, z: 40 },
  },
  {
    id: "shasta-stream",
    photoId: "photo-049",
    title: "Shasta · stream",
    detail: "Shasta beside a winding meadow stream.",
    point: { x: -12, z: -31 },
  },
  {id:"desert-ridges",photoId:"photo-003",title:"Desert ridges",detail:"Dry ridges with snowy mountains beyond.",point:{x:36,z:-39}},
  {id:"rainforest-leaves",photoId:"photo-020",title:"Tropical leaves",detail:"Leaves and stems against a misty hillside.",point:{x:46,z:42}},
  {id:"lagoon-shore",photoId:"photo-024",title:"Tropical shore",detail:"Palms above clear shallow water.",point:{x:53,z:25}},

] as const;

export type WorldVideoPoint = {
  id: string;
  title: string;
  detail: string;
  point: Point;
  src: string;
  posterSrc?: string;
  reef: "kelp" | "lagoon";
};

/**
 * Snorkeling video discoveries intentionally stay empty until Sid's real clips are
 * added to the repo/media pipeline. Adding an entry here makes it discoverable in
 * place without changing renderer or dialog code.
 */
export const SNORKEL_VIDEO_POINTS: WorldVideoPoint[] = [];

export const SECRET = { x: 18, z: 22 };
export const SPAWN = { x: 0, z: 16 };

function rawTerrainHeight(x: number, z: number): number {
  const main = 24.5 * Math.exp(-((x - 7) ** 2 / 560 + (z + 61) ** 2 / 650));
  const westPeak = 12.8 * Math.exp(-((x + 19) ** 2 / 520 + (z + 69) ** 2 / 470));
  const shoulder = 6.8 * Math.exp(-((x - 4) ** 2 / 720 + (z + 36) ** 2 / 620));
  const canyonRise = 2.2 * Math.exp(-((x - 31) ** 2 / 500 + (z - 24) ** 2 / 850));
  const backside = 5.5 * Math.exp(-((x-16)**2/340+(z+78)**2/180));
  const dryRidge = 3 * Math.exp(-((x-35)**2/210+(z+43)**2/450));
  return 0.65 + main + westPeak + shoulder + canyonRise + backside + dryRidge +
    Math.sin(x * 0.085) * 0.42 + Math.cos(z * 0.105) * 0.5;
}

const smoothstep01 = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * Soft mask for the carved arcade tunnel. It flattens only the walkable core,
 * blending back into the natural mountain under the authored rock shell.
 */
export function arcadeCaveTerrainMask(x: number, z: number): number {
  const startZ = ARCADE_CAVE.entrance.z - 6;
  const endZ = ARCADE_CAVE.wall.z + 1.4;
  if (z <= startZ || z >= endZ) return 0;
  const fadeIn = smoothstep01((z - startZ) / 6);
  const fadeOut = 1 - smoothstep01((z - (endZ - 1.5)) / 1.5);
  const lateral = Math.abs(x - ARCADE_CAVE.entrance.x);
  // Keep the carved floor flat underneath the authored side-wall footprint.
  // The old core ended inside the wall and let the mountain rise through the
  // interior as a bright triangular seam.
  const core = caveHalfWidth(z) + 0.5;
  const feather = 1.4;
  const lateralMask =
    lateral <= core
      ? 1
      : 1 - smoothstep01((lateral - core) / feather);
  return Math.max(0, Math.min(1, fadeIn * fadeOut * lateralMask));
}

export function caveHalfWidth(z:number) {
  return 3.1 + smoothstep01((z + 75) / 5) * 3.0;
}
export const PAPER_CAVE = {x:-20,z:-30,backZ:-36,halfWidth:4} as const;
export function paperCaveInside(p:Point) {return Math.abs(p.x-PAPER_CAVE.x)<3.5 && p.z < -31 && p.z > -35.5;}
export function arcadeInside(p:Point) {return p.z>-81.5 && p.z<-63 && Math.abs(p.x-16)<caveHalfWidth(p.z)-.3;}
export function terrainHeight(x: number, z: number): number {
  let base = rawTerrainHeight(x, z);
  const caveMask = arcadeCaveTerrainMask(x, z);
  const caveFloor = rawTerrainHeight(16,-83);
  base += (caveFloor - base) * caveMask;
  const paperMask = smoothstep01((z+38)/2)*(1-smoothstep01((z+30)/3))*(1-smoothstep01((Math.abs(x+20)-4)/2));
  base += (rawTerrainHeight(-20,-24)-base)*paperMask;
  return base;
}
/** Roof tie-in samples the uncarved mountain; collision uses the flat floor. */
export const mountainSurfaceHeight = rawTerrainHeight;

export function coastlineX(z: number): number {
  return -34 + Math.sin(z * 0.075) * 1.7 + Math.sin(z * 0.021 + 1.8) * 0.8;
}

export function eastCoastlineX(z: number): number {
  return 58 + Math.sin(z * 0.067 + 0.7) * 1.9 + Math.sin(z * 0.019) * 1.1;
}

export type WaterZone = "kelp" | "lagoon";
export function waterZone(point: Point): WaterZone | null {
  if (point.x < coastlineX(point.z) - 0.35) return "kelp";
  if (point.x > eastCoastlineX(point.z) + 0.35) return "lagoon";
  return null;
}

export function isWater(point: Point): boolean {
  return waterZone(point) !== null;
}

export function seaFloorHeight(x: number, z: number): number {
  const zone = waterZone({ x, z });
  if (zone === "lagoon") {
    const offshore = Math.max(0, x - eastCoastlineX(z));
    const shelf = SEA_SURFACE - 1.9 - Math.min(7.4, offshore * 0.17);
    const sandRipples = Math.sin(z * 0.18 + 0.8) * 0.2 + Math.cos(x * 0.14) * 0.16;
    const coralGarden = 1.65 * Math.exp(-((x - 72) ** 2 / 250 + (z - 11) ** 2 / 460));
    return shelf + sandRipples + coralGarden;
  }
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
  if (paperCaveInside(point)) return "paper-archive";
  if (distance(point, SECRET) < 3.5) return "secret";
  const video = SNORKEL_VIDEO_POINTS.find((m) => distance(point, m.point) < 3.2);
  if (video) return video.id;
  const memory = MEMORY_POINTS.find((m) => distance(point, m.point) < 3.2);
  if (memory) return memory.id;
  const region = REGIONS.find((r) => distance(point, r.point) < 6);
  return region?.id ?? null;
}

/**
 * Deterministic semantic landing points keep menu travel useful as geography evolves.
 * The coast landing sits just inland of the shoreline so entering the water remains
 * an immediate, discoverable action instead of a hidden cross-country walk.
 */
export function regionLanding(region: RegionId): Point {
  const target = REGIONS.find((r) => r.id === region)!;
  const z = target.point.z + 3;
  if (region === "coast")
    return { x: coastlineX(z) + 1.35, z };
  if (region === "lagoon")
    return { x: eastCoastlineX(z) - 1.35, z };
  if (region === "cavern")
    return { ...ARCADE_CAVE.approach };
  return { x: target.point.x, z };
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
export type WorldVideo = {
  id: string;
  title: string;
  detail: string;
  src: string;
  posterSrc?: string;
};
export type WorldContent = {
  projects: WorldProject[];
  photos: WorldPhoto[];
  publications: {id:string;title:string;year:number|null;href:string}[];
  videos: WorldVideo[];
  games: { title: string; subtitle: string; href: string }[];
};
export type WorldCommand = {
  region: RegionId;
  serial: number;
  activity?: import("./activities").Activity;
};
