import { isWater, SEA_SURFACE, terrainHeight, worldFloorHeight } from "./model";
export const SNOWMELT_PATH = [
  { x: -13, z: -66 },
  { x: -16, z: -61 },
  { x: -20, z: -56 },
  { x: -23, z: -51 },
  { x: -23, z: -46 },
  { x: -21, z: -42 },
] as const;
type WaterPoint = { x: number; y: number; z: number };
/** Sample relief between control points so long chords cannot disappear below terrain. */
function surfaceRibbon(points: WaterPoint[]) {
  const sampled = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .08);
    for (let j = 1; j <= count; j++) {
      const t = j / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      sampled.push({ x, z, y: Math.max(a.y + (b.y - a.y) * t, worldFloorHeight(x, z) + .1) });
    }
  }
  // Small undulations become gently descending reaches, never uphill water.
  for (let i = sampled.length - 2; i >= 0; i--) sampled[i].y = Math.max(sampled[i].y, sampled[i + 1].y + .0001);
  return sampled;
}
export function drainagePoints() {
  const lip = waterfallProfile().lip;
  return surfaceRibbon([...SNOWMELT_PATH.map((p) => ({
    ...p,
    y: terrainHeight(p.x, p.z) + 0.09,
  })), { x: -20, z: -37, y: lip.y + 0.3 },
  { x: -20, z: -34, y: lip.y + 0.15 }, lip]);
}
export const DOWNSTREAM_PATH = [
  { x: -20, z: -25 },
  { x: -21, z: -22 },
  { x: -23, z: -19 },
  { x: -26, z: -15 },
  { x: -29, z: -11 },
  { x: -32, z: -7 },
  { x: -34, z: -4 },
  { x: -36, z: -1 },
] as const;

/** Renderer and drainage share exact contact heights, independent of approach terrain. */
export function waterfallProfile() {
  // The plunge pool is surface terrain. The archive chamber has its own
  // lower support surface and must not flatten this waterfall shoulder.
  const floorY = terrainHeight(-20, -27);
  return {
    floorY,
    lip: { x: -20, z: -30, y: Math.max(floorY + 5.35, terrainHeight(-20, -30) + 0.14) },
    pool: { x: -20, z: -27, y: floorY + 0.22 },
  };
}

/** Pool exit and creek share one height profile; the final reach meets the sea. */
export function downstreamPoints() {
  const poolY = waterfallProfile().pool.y;
  return surfaceRibbon(DOWNSTREAM_PATH.map((p, i) => ({
    ...p,
    y: i === 0 ? poolY : isWater(p) ? SEA_SURFACE + 0.02 : terrainHeight(p.x, p.z) + 0.1,
  })));
}

/** Crown support for the stream where the hillside becomes the archive roof.
 * Each ring follows the same water samples, avoiding a floating stream above a
 * constant-height slab. The center channel is shallow; outer shoulders tie into
 * the surrounding mountain, leaving the interior chamber beneath it. */
export function waterfallCrownRings(): WaterPoint[][] {
  return drainagePoints().filter(p => p.z >= -42).map(p => [
    { x: p.x - 7, y: terrainHeight(p.x - 7, p.z), z: p.z },
    { x: p.x - 3.6, y: Math.max(p.y + .25, terrainHeight(p.x - 3.6, p.z)), z: p.z },
    { x: p.x - 1.25, y: p.y - .07, z: p.z },
    { x: p.x, y: p.y - .07, z: p.z },
    { x: p.x + 1.25, y: p.y - .07, z: p.z },
    { x: p.x + 3.6, y: Math.max(p.y + .25, terrainHeight(p.x + 3.6, p.z)), z: p.z },
    { x: p.x + 7, y: terrainHeight(p.x + 7, p.z), z: p.z },
  ]);
}
