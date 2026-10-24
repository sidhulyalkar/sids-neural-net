/** Procedural eastern lagoon channel. Never changes the shoreline or water classification. */
export const RAY_PASSAGE = {
  centerX: 82,
  centerZ: 8,
  stations: [{ x: 73.8, z: -6.5 }, { x: 74.5, z: 27 }],
} as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (v: number) => v - Math.floor(v);

/** The cut fades to zero before the beach, world edges, and both ends. */
export function rayPassageDepth(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x <= 64) return 0;
  const axis = RAY_PASSAGE.centerX + 2.1 * Math.sin((z - 8) * .035);
  const lateral = 1 - smooth((Math.abs(x - axis) - 3) / 10.5);
  const longitudinal = 1 - smooth((Math.abs(z - 8) - 27) / 16);
  return 4.35 * lateral * longitudinal * smooth((x - 64) / 8);
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
    cleaningStation: i === 1 || i === 5 ? i % 2 : null,
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
  let x = 81 + lane + Math.sin(phase * Math.PI * 2 + spec.index * .7) * (benthic ? 3 : 2);
  let z = -28 + 78 * phase;
  if (benthic) {
    x = 82.5 + lane * Math.cos(phase * Math.PI * 2 + spec.index);
    z = -11 + (spec.index - 9) * 15 + Math.sin(phase * Math.PI * 2) * 10;
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
  return {
    x, y, z,
    yaw: lerp(.06 * Math.sin(t * .13 + spec.index), -.35, influence),
    bank: (1 - influence) * Math.sin(t * .72 + spec.index) * .055,
    wingPhase: t * (benthic ? .84 : 1.35) + spec.index * .6,
    activity: benthic ? "foraging" : influence > .82 ? "cleaning" :
      influence > .08 ? "approaching" : "travelling",
    visible: benthic || (phase > .025 && phase < .975),
  };
}

export type MarineAnchor = { id: string; x: number; z: number; reach: number };
export const PASSAGE_ANCHORS: readonly MarineAnchor[] = [
  ...RAY_PASSAGE.stations.map((p, i) => ({ id: `ray-cleaning-${i}`, ...p, reach: 16 })),
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
