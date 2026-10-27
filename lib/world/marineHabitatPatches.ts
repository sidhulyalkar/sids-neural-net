import {NORTHEAST_SANDBARS} from "./northeastSandbars";
import { SEA_SURFACE, seaFloorHeight, waterZone } from "./model";

/** Authored ecological neighborhoods layered over the existing water zones.
 * No terrain edits, collision objects, or global spawn-time randomness.
 */
export type ReefZone = "kelp" | "lagoon";
export type MarineKind =
  | "baby-turtle" | "whipray" | "blacktip" | "giant-clam" | "pearl-clam" | "seagrass"
  | "boulder" | "slab" | "spire" | "kelp" | "sand-ripple"
  | "branch-coral" | "table-coral" | "fan-coral" | "anemone"
  | "sea-star" | "urchin" | "crab" | "lobster" | "nudibranch"
  | "moray" | "jelly" | "reef-fish" | "baitfish" | "clownfish" | "angelfish";

export type MarinePatch = Readonly<{
  id: string;
  zone: ReefZone;
  theme: string;
  x: number;
  z: number;
  radius: number;
  /** Counts are fixed and auditable. No unbounded procedural spawn loop. */
  population: Partial<Readonly<Record<MarineKind, number>>>;
}>;

export const MARINE_HABITAT_PATCHES: readonly MarinePatch[] = [
  {
    id: "west-kelp-cathedral", zone: "kelp", theme: "kelp-corridor",
    x: -66, z: -39, radius: 10,
    population: { boulder: 10, spire: 7, kelp: 44, "reef-fish": 16, baitfish: 20, urchin: 8 },
  },
  {
    id: "west-boulder-archives", zone: "kelp", theme: "rocky-crevices",
    x: -66, z: -10, radius: 10,
    population: { boulder: 14, slab: 11, spire: 4, moray: 5, lobster: 7, crab: 10, "reef-fish": 12 },
  },
  {
    id: "west-tidepool-shelf", zone: "kelp", theme: "anemone-shelf",
    x: -55, z: 18, radius: 8,
    population: { boulder: 8, slab: 10, anemone: 18, "sea-star": 17, urchin: 10, nudibranch: 8, crab: 7 },
  },
  {
    id: "west-drift-sand", zone: "kelp", theme: "cold-sand-flat",
    x: -75, z: 32, radius: 9,
    population: { "sand-ripple": 35, slab: 5, baitfish: 25, "sea-star": 8, crab: 8, nudibranch: 7 },
  },
  {
    id: "west-jelly-blue", zone: "kelp", theme: "jelly-corridor",
    x: -82, z: -6, radius: 7,
    population: { boulder: 5, kelp: 13, jelly: 9, baitfish: 18, "reef-fish": 8 },
  },
  {
    id: "east-coral-crescent", zone: "lagoon", theme: "coral-crescent",
    x: 71, z: -37, radius: 8,
    population: { boulder: 7, "branch-coral": 18, "table-coral": 13, "fan-coral": 13, "reef-fish": 20, baitfish: 18, angelfish: 11 },
  },
  {
    id: "east-anemone-garden", zone: "lagoon", theme: "clownfish-garden",
    x: 73, z: -9, radius: 7,
    population: { "branch-coral": 9, "fan-coral": 7, anemone: 36, "reef-fish": 22, crab: 7, nudibranch: 10, clownfish: 16 },
  },
  {
    id: "east-coral-bommies", zone: "lagoon", theme: "coral-bommies",
    x: 80, z: 21, radius: 8,
    population: { boulder: 12, spire: 7, "branch-coral": 15, "table-coral": 10, "fan-coral": 11, baitfish: 28, "reef-fish": 21, angelfish: 9 },
  },
  {
    id: "east-rubble-garden", zone: "lagoon", theme: "rubble-nudibranch-slope",
    x: 85, z: 43, radius: 7,
    population: { boulder: 9, slab: 11, "sand-ripple": 18, "sea-star": 13, nudibranch: 19, urchin: 12, crab: 8 },
  },
  {
    id: "east-seagrass-channel", zone: "lagoon", theme: "sand-channel",
    x: 85, z: -7, radius: 7,
    population: { "sand-ripple": 25, kelp: 23, "table-coral": 8, anemone: 15, baitfish: 33, lobster: 6 },
  },
  {
    id: "west-wild-coast-coral-garden", zone: "kelp", theme: "coral-islets",
    x: -69, z: 57, radius: 10,
    population: { boulder: 8, "branch-coral": 24, "table-coral": 18,
      "fan-coral": 20, anemone: 12, "sea-star": 9, "reef-fish": 18, baitfish: 22 },
  },
  // Nearshore stepping stones fill the long gaps north and south of the
  // established offshore gardens. Keep populations modest and forms shared.
  {
    id: "west-kelp-nursery", zone: "kelp", theme: "nearshore-kelp-nursery",
    x: -49, z: 80, radius: 7,
    population: { kelp: 16, boulder: 5, anemone: 9, "sea-star": 8,
      crab: 5, "reef-fish": 10, baitfish: 16 },
  },
  {
    id: "west-anemone-cove", zone: "kelp", theme: "sheltered-anemone-cove",
    x: -49, z: -76, radius: 7,
    population: { boulder: 7, slab: 6, anemone: 18, "fan-coral": 9,
      "sea-star": 8, lobster: 4, nudibranch: 6, "reef-fish": 10 },
  },
  {
    id: "east-shallow-coral-lagoon", zone: "lagoon", theme: "shallow-coral-lagoon",
    x: 73, z: 76, radius: 8,
    population: { "branch-coral": 14, "table-coral": 10, anemone: 12,
      "sand-ripple": 8, clownfish: 8, "reef-fish": 12, "sea-star": 6 },
  },
  {
    id: "east-southern-reef-garden", zone: "lagoon", theme: "southern-fan-garden",
    x: 73, z: -73, radius: 8,
    population: { boulder: 6, "fan-coral": 16, "branch-coral": 12,
      "table-coral": 8, angelfish: 8, baitfish: 14, crab: 5, nudibranch: 6 },
  },
  ...NORTHEAST_SANDBARS.map((bank,i):MarinePatch=>({
    ...bank,zone:"lagoon",theme:bank.id,
    population:([
      {whipray:5,"sand-ripple":20,"reef-fish":10,seagrass:8},
      {blacktip:3,whipray:2,baitfish:16,"sand-ripple":12},
      {"baby-turtle":7,seagrass:25,"reef-fish":8,"sand-ripple":12},
      {"giant-clam":12,"pearl-clam":3,seagrass:8,"fan-coral":5,"reef-fish":8},
    ] as Partial<Record<MarineKind,number>>[])[i],
  })),
] as const;

export type HabitatPoint = {
  x: number; y: number; z: number;
  yaw: number; scale: number; patchId: string; kind: MarineKind;
};

function hash(text: string) {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++)
    result = Math.imul(result ^ text.charCodeAt(i), 16777619);
  return result >>> 0;
}
function generator(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
/** Pure deterministic placement on the authoritative seabed. High rocks and
 * plants are checked against the sea surface, preventing dry coral or kelp.
 */
export function marineHabitatPoint(patch: MarinePatch, kind: MarineKind, index: number): HabitatPoint {
  if (!Number.isInteger(index) || index < 0 || index >= (patch.population[kind] ?? 0))
    throw new RangeError("Marine habitat index outside authored population");
  const next = generator(hash(`${patch.id}:${kind}:${index}`));
  const isTall = kind === "kelp" || kind === "spire";
  const scale = kind==="baby-turtle"?.42+next()*.14:kind==="blacktip"?.42+next()*.13:isTall ? .65 + next() * .52 : .45 + next() * .55;
  const required = ["baby-turtle","whipray","blacktip","giant-clam","pearl-clam","seagrass"].includes(kind)?1.2:isTall ? 3.4*scale :
    kind==="boulder" ? 1.8*scale :
    kind==="angelfish" ? 3.3*scale :
    kind==="clownfish" ? 2.2*scale :
    kind==="jelly" ? 2.2 :
    kind.includes("coral") ? 2.2*scale : 1.3*scale;
  for (let attempt = 0; attempt < 64; attempt++) {
    const theta = next() * Math.PI * 2;
    const radius = Math.sqrt(next()) * patch.radius;
    const x = patch.x + Math.cos(theta) * radius;
    const z = patch.z + Math.sin(theta) * radius;
    const floor = seaFloorHeight(x, z);
    // Keep vegetation and coral on the bank rims, leaving sandy swim lanes.
    if(patch.theme.startsWith("east-")&&(kind==="seagrass"||kind.includes("coral"))&&radius<patch.radius*.62)continue;
    if (waterZone({x,z}) !== patch.zone || floor + required >= SEA_SURFACE - .3) continue;
    return {x, y: floor, z, yaw: next() * Math.PI * 2, scale,
      patchId: patch.id, kind};
  }
  throw new Error(`No submerged habitat position for ${patch.id}/${kind}/${index}`);
}

export function marineHabitatCounts(zone: ReefZone) {
  const counts: Partial<Record<MarineKind,number>> = {};
  for (const patch of MARINE_HABITAT_PATCHES) {
    if (patch.zone !== zone) continue;
    for (const [kind,number] of Object.entries(patch.population) as [MarineKind,number][])
      counts[kind] = (counts[kind] ?? 0) + number;
  }
  return counts;
}

/** Closest named discovery within its authored boundary. No per-frame heap
 * allocation or spatial tree necessary for a small fixed set of patches.
 */
export function marineHabitatAt(point: {x:number;z:number}, zone: ReefZone): MarinePatch | null {
  let best: MarinePatch | null=null, distance=Infinity;
  for(const patch of MARINE_HABITAT_PATCHES) {
    if(patch.zone!==zone)continue;
    const d=Math.hypot(point.x-patch.x,point.z-patch.z);
    if(d<patch.radius+1.7 && d<distance){best=patch;distance=d;}
  }
  return best;
}
export function marineHabitatLabel(patch: MarinePatch):string {
  const words=patch.id.replace(/^(west|east)-/,"").split("-");
  return words.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
}
