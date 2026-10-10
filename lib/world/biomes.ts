import {
  terrainHeight,
  isWater,
  waterZone,
  coastlineX,
  eastCoastlineX,
  type Point,
} from "./model";
export type BiomeId =
  | "alpine"
  | "redwood"
  | "coastal-scrub"
  | "cold-beach"
  | "kelp"
  | "lagoon"
  | "rainforest"
  | "desert";
export const BIOME_COLORS: Record<BiomeId, string> = {
  alpine: "#dbe2df",
  redwood: "#65735b",
  "coastal-scrub": "#a49b75",
  "cold-beach": "#d5c3a0",
  kelp: "#526d61",
  lagoon: "#d2c7a4",
  rainforest: "#536a48",
  desert: "#c5b18b",
};
export const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Continuous, deterministic weights. Labels are informational, never material switches. */
export function biomeAt(p: Point) {
  const h = terrainHeight(p.x, p.z),
    n = Math.sin(p.x * 0.08) * 2 + Math.sin(p.z * 0.095) * 2;
  const alpine = smooth(10, 24, h),
    desert = smooth(20, 37, p.x + n) * (1 - smooth(-22, 4, p.z)) * (1 - alpine);
  const rainforest =
    smooth(14, 32, p.x) * smooth(8, 27, p.z + n) * (1 - alpine);
  const beach = Math.max(
    1 - smooth(0, 7, Math.max(0, p.x - coastlineX(p.z))),
    1 - smooth(0, 7, Math.max(0, eastCoastlineX(p.z) - p.x)),
  );
  const redwood =
    (1 - smooth(9, 25, p.x)) * (1 - smooth(20, 42, p.z)) * (1 - alpine);
  const weights: Record<BiomeId, number> = {
    alpine,
    desert: desert * (1 - beach),
    redwood: redwood * (1 - beach),
    rainforest: rainforest * (1 - beach),
    "cold-beach": beach,
    "coastal-scrub": 0.32 * (1 - alpine) * (1 - beach),
    kelp: 0,
    lagoon: 0,
  };
  if (isWater(p)) {
    for (const k of Object.keys(weights) as BiomeId[]) weights[k] = 0;
    const zone = waterZone(p)!;
    const offshore = zone === "kelp" ? coastlineX(p.z) - p.x : p.x - eastCoastlineX(p.z);
    const marine = smooth(0.35, 5.35, offshore);
    weights["cold-beach"] = 1 - marine;
    weights[zone] = marine;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const k of Object.keys(weights) as BiomeId[]) weights[k] /= total;
  } else weights["coastal-scrub"] = 1;
  const slope = Math.hypot(
    terrainHeight(p.x + 0.5, p.z) - terrainHeight(p.x - 0.5, p.z),
    terrainHeight(p.x, p.z + 0.5) - terrainHeight(p.x, p.z - 0.5),
  );
  const ranked = (Object.keys(weights) as BiomeId[]).sort(
    (a, b) => weights[b] - weights[a],
  );
  return {
    primary: ranked[0],
    secondary: ranked[1],
    blend: weights[ranked[1]],
    weights,
    elevation: h,
    moisture: weights.redwood * 0.7 + weights.rainforest,
    exposure: weights.desert,
    slope,
    substrate: {
      sand: weights["cold-beach"] + weights.lagoon,
      rock: smooth(0.35, 1.2, slope),
      soil: (1 - weights["cold-beach"] - weights.kelp - weights.lagoon) * (1 - smooth(0.35, 1.2, slope)),
    },
  };
}
export const DESERT_FORMATIONS = [
  // Low, weathered outcrops stay away from the central dirt loop.
  { id: "talus-north", x: 52, z: -49, sx: 2.4, sy: 1.15, sz: 3.1 },
  { id: "talus-east", x: 53, z: -22, sx: 2.6, sy: 1.3, sz: 3.0 },
  { id: "talus-south", x: 46, z: -8, sx: 2.1, sy: 1.05, sz: 2.5 },
] as const;
