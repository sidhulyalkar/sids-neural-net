/** Dedicated offshore southern snorkeling passage at the volcanic arch.
 * Its habitat occupies existing offshore jet-ski scenery and never carves
 * the island, west kelp reef, east lagoon, or north skim beach. */
export const RAY_PASSAGE = {
  centerX: 17,
  centerZ: -127,
  stations: [{ x: 8.5, z: -119 }, { x: 26.5, z: -137 }],
} as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (v: number) => v - Math.floor(v);

/** Southern volcanic-arch trench: bounded, smooth, and ZERO inside the
 * original playable island (z >= -96).  This is sampled by BOTH bathymetry
 * and the new south-water seabed mesh, so visible and physical floor agree. */
export function rayPassageDepth(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z) || z >= -96 || z <= -166) return 0;
  const axis = RAY_PASSAGE.centerX + 1.1 * Math.sin((z + 127) * .065);
  const lateral = 1 - smooth((Math.abs(x - axis) - 8) / 13);
  const longitudinal = 1 - smooth((Math.abs(z + 127) - 16) / 22);
  const shoreFade = smooth((-z - 108) / 14);
  return 17.5 * lateral * longitudinal * shoreFade;
}

export type RayKind = "eagle" | "manta" | "stingray";
export type RaySpec = {
  readonly id: string; readonly kind: RayKind;
  readonly index: number; readonly cleaningStation: number | null;
};
/** School of eight eagle rays, one manta, three smaller benthic rays. */
export const RAY_PASSAGE_CAST: readonly RaySpec[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `passage-eagle-${i}`, kind: "eagle" as const, index: i,
    cleaningStation: i === 1 ? 0 : i === 5 ? 1 : null,
  })),
  { id: "passage-manta", kind: "manta", index: 8, cleaningStation: 1 },
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `passage-stingray-${i}`, kind: "stingray" as const,
    index: i + 9, cleaningStation: null,
  })),
];

export type RayPose = {
  x: number; y: number; z: number; yaw: number; bank: number;
  wingPhase: number; activity: "travelling" | "approaching" | "cleaning" | "foraging";
  visible: boolean;
};
/** Pure absolute-time movement: deterministic and inexpensive, even after tab pause. */
export function sampleRayPassage(
  spec: RaySpec, time: number,
  floorAt: (x: number, z: number) => number, seaSurface: number,
): RayPose {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const benthic = spec.kind === "stingray";
  const speed = benthic ? 1 / 174 : spec.kind === "manta" ? 1 / 180 : 1 / 132;
  const offset = spec.kind === "eagle"
    ? (spec.index % 4) * .023 + Math.floor(spec.index / 4) * .25
    : spec.index * .097;
  const phase = fract(t * speed + offset);
  const lane = spec.kind === "manta" ? 3.8 :
    benthic ? 4.6 : (spec.index % 3 - 1) * 1.4;
  let x = 16 + lane + Math.sin(phase * Math.PI * 2 + spec.index * .7) * (benthic ? 3 : 2);
  let z = -146 + 31 * phase;
  if (benthic) {
    x = 15 + lane * Math.cos(phase * Math.PI * 2 + spec.index);
    z = -139 + (spec.index - 9) * 9 + Math.sin(phase * Math.PI * 2) * 5;
  }
  const canClean = spec.cleaningStation !== null;
  const influence = canClean
    ? smooth((phase - .255) / .09) * (1 - smooth((phase - .545) / .095))
    : 0;
  if (canClean) {
    const station = RAY_PASSAGE.stations[spec.cleaningStation!];
    x = lerp(x, station.x + (spec.index % 3) * .65, influence);
    z = lerp(z, station.z + Math.sin(t * .26 + spec.index) * .35, influence);
  }
  const floor = floorAt(x, z);
  const clearance = benthic ? .4 : spec.kind === "manta" ? 1.15 : .85;
  const preferredY = benthic ? floor + clearance :
    seaSurface - (spec.kind === "manta" ? 3.1 : 2.65) - .2 * Math.sin(t * .4 + spec.index);
  const y = Math.max(floor + clearance, Math.min(seaSurface - .72, preferredY));
  const stationDistance = canClean
    ? Math.hypot(x - RAY_PASSAGE.stations[spec.cleaningStation!].x,
        z - RAY_PASSAGE.stations[spec.cleaningStation!].z)
    : Infinity;
  return {
    x, y, z,
    yaw: lerp(.06 * Math.sin(t * .13 + spec.index), -.35, influence),
    bank: (1 - influence) * Math.sin(t * .72 + spec.index) * .055,
    wingPhase: t * (benthic ? .84 : 1.35) + spec.index * .6,
    activity: benthic ? "foraging" : influence > .82 && stationDistance < 2.8 ? "cleaning" :
      influence > .08 ? "approaching" : "travelling",
    visible: benthic || (phase > .025 && phase < .975),
  };
}

export type MarineAnchor = { id: string; x: number; z: number; reach: number };
export const PASSAGE_ANCHORS: readonly MarineAnchor[] = [
  ...RAY_PASSAGE.stations.map((p, i) => ({ id: `ray-cleaning-${i}`, ...p, reach: 16 })),
  { id: "southern-arch", x: 17, z: -127, reach: 24 },
  { id: "coral-crescent", x: 73, z: 13, reach: 17 },
  { id: "turtle-garden", x: 79, z: 20, reach: 15 },
  { id: "cold-kelp", x: -53, z: 12, reach: 24 },
  { id: "north-sandbar", x: 0, z: 58, reach: 22 },
];

/** Reports uncovered entry points instead of pretending the whole ocean is populated. */
export function marineEntryCoverage(
  entries: readonly { x: number; z: number }[],
  anchors: readonly MarineAnchor[] = PASSAGE_ANCHORS,
) {
  return entries.map(p => {
    const nearest = anchors.map(a => ({ id: a.id, distance: Math.hypot(p.x-a.x, p.z-a.z), reach: a.reach }))
      .sort((a,b) => a.distance - b.distance)[0];
    return { ...p, nearest: nearest?.id ?? null, distance: nearest?.distance ?? Infinity,
      covered: Boolean(nearest && nearest.distance <= nearest.reach) };
  });
}
