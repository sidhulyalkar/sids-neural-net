import type { Point } from "./model";

/**
 * Expanded Joshua basin course. One deterministic, closed, measured centerline
 * is authoritative for ground pigment, collision clearance, berms and tests.
 * This module is runtime-pure: model.ts imports it, so NO runtime import back
 * into model or biome.ts is permitted here.
 */
export const DESERT_TRACK = {
  previousLength: 60 + 10 * Math.PI,
  treadHalfWidth: 2.2,
  clearance: 3.35,
  spatialCell: 6,
} as const;

export type TrackSegment =
  | "shoulder-descent" | "lower-turn-a" | "pump-return"
  | "upper-turn" | "technical-descent" | "lower-turn-b"
  | "east-return" | "north-overlook" | "scrub-return";
type Knot = Point & { s: number; segment: TrackSegment };
export type TrackFrame = {
  center: Point;
  tangent: Point;
  lateral: number;
  distance: number;
  s: number;
  segment: TrackSegment;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const knots: Knot[] = [{ x: 27, z: -10, s: 0, segment: "shoulder-descent" }];
const add = (point: Point, segment: TrackSegment) => {
  const previous = knots[knots.length - 1];
  const length = dist(previous, point);
  if (length < 1e-9) return;
  knots.push({ ...point, s: previous.s + length, segment });
};
const line = (to: Point, segment: TrackSegment) => {
  const a = knots[knots.length - 1];
  const n = Math.max(1, Math.ceil(dist(a, to) / 0.48));
  for (let i = 1; i <= n; i++)
    add({ x: a.x + (to.x - a.x) * i / n, z: a.z + (to.z - a.z) * i / n }, segment);
};
const hairpin = (cx: number, cz: number, start: number, end: number, segment: TrackSegment) => {
  const n = 58, radius = 4;
  for (let i = 1; i <= n; i++) {
    const angle = start + (end - start) * i / n;
    add({ x: cx + radius * Math.cos(angle), z: cz + radius * Math.sin(angle) }, segment);
  }
};
const bezier = (b: Point, c: Point, d: Point, segment: TrackSegment) => {
  const a = knots[knots.length - 1], n = 76;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    add({
      x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      z: u*u*u*a.z + 3*u*u*t*b.z + 3*u*t*t*c.z + t*t*t*d.z,
    }, segment);
  }
};

// Four distinctive straights, three tangent U-turns, a long inhabited scrub
// return. The outer loop is the real return, never a counted second lap.
line({ x: 27, z: -57 }, "shoulder-descent");
hairpin(31, -57, Math.PI, 2 * Math.PI, "lower-turn-a");
line({ x: 35, z: -12 }, "pump-return");
hairpin(39, -12, Math.PI, 0, "upper-turn");
line({ x: 43, z: -57 }, "technical-descent");
hairpin(47, -57, Math.PI, 2 * Math.PI, "lower-turn-b");
line({ x: 51, z: -8 }, "east-return");
bezier({ x: 51, z: 1 }, { x: 54, z: 9 }, { x: 43, z: 9 }, "north-overlook");
line({ x: 24, z: 9 }, "north-overlook");
bezier({ x: 17, z: 9 }, { x: 11, z: 3 }, { x: 14, z: -8 }, "scrub-return");
bezier({ x: 17, z: -19 }, { x: 27, z: -3 }, { x: 27, z: -10 }, "scrub-return");

export const DESERT_TRACK_LENGTH = knots[knots.length - 1].s;
const CELL = DESERT_TRACK.spatialCell;
const index = new Map<string, number[]>();
const key = (ix: number, iz: number) => `${ix},${iz}`;
for (let i = 0; i < knots.length - 1; i++) {
  const a = knots[i], b = knots[i + 1];
  const pad = 7.5;
  const minX = Math.floor((Math.min(a.x, b.x) - pad) / CELL);
  const maxX = Math.floor((Math.max(a.x, b.x) + pad) / CELL);
  const minZ = Math.floor((Math.min(a.z, b.z) - pad) / CELL);
  const maxZ = Math.floor((Math.max(a.z, b.z) + pad) / CELL);
  for (let ix = minX; ix <= maxX; ix++)
    for (let iz = minZ; iz <= maxZ; iz++) {
      const k = key(ix, iz), bucket = index.get(k);
      if (bucket) bucket.push(i);
      else index.set(k, [i]);
    }
}

/** Nearest course cross-section using spatial bins, not a global O(N) scan. */
export function desertTrackFrame(p: Point): TrackFrame {
  const candidate = index.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
  if (!candidate?.length) return {
    center: p, tangent: { x: 0, z: -1 }, lateral: 0,
    distance: Infinity, s: 0, segment: "shoulder-descent",
  };
  let best: TrackFrame | undefined;
  for (const i of candidate) {
    const a = knots[i], b = knots[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const lengthSquared = dx*dx + dz*dz;
    if (lengthSquared < 1e-12) continue;
    const t = clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/lengthSquared,0,1);
    const center = { x: a.x+dx*t, z: a.z+dz*t };
    const offset = { x: p.x-center.x, z: p.z-center.z };
    const distance = Math.hypot(offset.x, offset.z);
    if (!best || distance < best.distance) {
      const length = Math.sqrt(lengthSquared);
      const tangent = {x:dx/length,z:dz/length};
      best = {
        center, tangent, distance,
        lateral: offset.x*tangent.z-offset.z*tangent.x,
        s: a.s+length*t,
        segment: a.segment,
      };
    }
  }
  return best!;
}

/** Efficient ordered polyline sampling from cumulative arc length. */
export function desertTrackSampleAt(s: number): Point {
  const distanceAlong = ((s % DESERT_TRACK_LENGTH) + DESERT_TRACK_LENGTH) % DESERT_TRACK_LENGTH;
  let low = 0, high = knots.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (knots[mid].s <= distanceAlong) low = mid;
    else high = mid;
  }
  const a = knots[low], b = knots[low + 1];
  const t = (distanceAlong - a.s) / Math.max(1e-8, b.s - a.s);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
}

/** Full closed lap, including exact duplicate endpoint for tests and debug. */
export function desertTrackCenterline(steps = 24): Point[] {
  const count = Math.max(96,Math.floor(steps)*4);
  return Array.from({ length:count + 1 },(_,i)=>
    i === count ? {x:knots[0].x,z:knots[0].z} : desertTrackSampleAt(i*DESERT_TRACK_LENGTH/count));
}

export function desertTrackClearance(p: Point) {
  if (p.x < 8 || p.x > 57 || p.z < -64 || p.z > 14) return false;
  return desertTrackFrame(p).distance < DESERT_TRACK.clearance;
}

/**
 * Existing safe sculpted kickers are retained in tranche 1. True lowered
 * arroyo / fallen-Joshua gaps + bypass physics are separately scoped tranche 2.
 */
export const DESERT_JUMPS = [
  { id:"desert-table", point:{ x:35, z:-27 }, heading:{x:0,z:1}, lift:2.4, height:0.76, landing:4.6 },
  { id:"desert-hip", point:{ x:43, z:-39 }, heading:{x:0,z:-1}, lift:2.8, height:0.9, landing:4.8 },
  { id:"desert-step", point:{ x:51, z:-26.5 }, heading:{x:0,z:1}, lift:3.8, height:1.0, landing:5.4 },
] as const;

export function desertJumpOffset(p: Point): number {
  let elevation = 0;
  for (const jump of DESERT_JUMPS) {
    const dx = p.x - jump.point.x, dz = p.z - jump.point.z;
    const along = dx * jump.heading.x + dz * jump.heading.z;
    const side = dx * jump.heading.z - dz * jump.heading.x;
    if (along < -5 || along > jump.landing + 4 || Math.abs(side) > 3.4) continue;
    const cross = 1-smooth(1.15,3.3,Math.abs(side));
    const lip = smooth(-4.1,-0.9,along)*(1-smooth(0,2.65,along));
    const landing = smooth(jump.landing-2.3,jump.landing-0.7,along)*
      (1-smooth(jump.landing+0.9,jump.landing+3.2,along));
    elevation += cross*jump.height*(lip+landing*0.64);
  }
  return elevation;
}

export function desertTrackHeightOffset(p: Point): number {
  if (p.x < 8 || p.x > 57 || p.z < -64 || p.z > 14) return 0;
  const frame = desertTrackFrame(p);
  if (frame.distance > 7) return 0;
  const tread = 1-smooth(1.1,3.5,frame.distance);
  let offset = -0.12*tread;
  if (frame.segment.includes("turn")) {
    // Outside shoulder creates a broad berm, feathered at the bank edge.
    offset += 0.75*smooth(-0.5,2.6,frame.lateral)*
      (1-smooth(3.4,6.5,frame.lateral));
  }
  // Three spaced rollers on the pump-return climb, away from the tabletop lip.
  for (const [x,z,h] of [[35,-47,0.3],[35,-20.5,0.4],[35,-16,0.46]]) {
    const dx=(p.x-x)/2.7,dz=(p.z-z)/2.8;
    offset += h*Math.exp(-1.65*(dx*dx+dz*dz));
  }
  return offset + desertJumpOffset(p);
}

export function desertTrackTreadBlend(p: Point): number {
  if (p.x < 8 || p.x > 57 || p.z < -64 || p.z > 14) return 0;
  return 1-smooth(1.5,3.5,desertTrackFrame(p).distance);
}
