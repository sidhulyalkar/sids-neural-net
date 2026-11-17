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
bezier({ x: 10, z: 9 }, { x: 7, z: 4 }, { x: 11, z: 0 }, "scrub-return");
bezier({ x: 15, z: -4 }, { x: 27, z: -5 }, { x: 27, z: -10 }, "scrub-return");

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

/**
 * A complete non-jumping route using actual bypasses at both pits. Used by
 * ground-oriented exploration paths and the slow-speed full-lap audit.
 * It never pretends that the open gap is a traversable tabletop.
 */
export function desertTrackGroundRoute(steps=48):Point[] {
  const gaps=DESERT_JUMPS.filter(j=>j.kind==="gap")
    .map(j=>({jump:j,start:desertTrackFrame(j.point).s-5.5,
      end:desertTrackFrame(j.point).s+j.landing+4.5}))
    .sort((a,b)=>a.start-b.start);
  const result:Point[]=[];
  const push=(p:Point)=>{
    if(!result.length||dist(result[result.length-1],p)>1e-6)result.push(p);
  };
  const addInterpolated=(points:readonly Point[])=>{
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],n=Math.ceil(dist(a,b)/0.6);
      for(let k=1;k<=n;k++)
        push({x:a.x+(b.x-a.x)*k/n,z:a.z+(b.z-a.z)*k/n});
    }
  };
  const count=Math.max(192,steps*4);
  let used=0;
  for(let i=0;i<=count;i++) {
    const along=i*DESERT_TRACK_LENGTH/count;
    while(used<gaps.length && along>=gaps[used].start) {
      const gap=gaps[used++];
      push(desertTrackSampleAt(gap.start));
      addInterpolated(desertGapBypassPoints(gap.jump));
    }
    if(gaps.some(g=>along>g.start&&along<g.end))continue;
    push(i===count?{x:knots[0].x,z:knots[0].z}:desertTrackSampleAt(along));
  }
  return result;
}

export function desertTrackClearance(p: Point) {
  if (p.x < 8 || p.x > 57 || p.z < -64 || p.z > 14) return false;
  return desertTrackFrame(p).distance < DESERT_TRACK.clearance ||
    desertBypassClearance(p);
}

/**
 * Two actually lowered gaps, plus the original rollable tabletop. Local
 * +along follows heading, +side is a consistent right-handed cross-axis.
 * Each pit retains real ground support; it is not a hole in the physics API.
 */
export const DESERT_JUMPS = [
  { id:"desert-table",kind:"table",obstacle:"none",point:{x:35,z:-27},heading:{x:0,z:1},
    lift:2.4,height:0.76,landing:4.6,gapStart:0,gapEnd:0,depth:0,minSpeed:3 },
  { id:"desert-hip",kind:"gap",obstacle:"fallen-joshua",point:{x:43,z:-39},heading:{x:0,z:-1},
    lift:3.3,height:0.72,landing:5.6,gapStart:1.05,gapEnd:4.25,depth:1.45,minSpeed:7 },
  { id:"desert-step",kind:"gap",obstacle:"dry-arroyo",point:{x:51,z:-26.5},heading:{x:0,z:1},
    lift:3.45,height:0.88,landing:6.35,gapStart:1.1,gapEnd:5.1,depth:1.65,minSpeed:8 },
] as const;

export type DesertJump = (typeof DESERT_JUMPS)[number];
export function jumpLocal(jump: DesertJump, p: Point) {
  const dx=p.x-jump.point.x,dz=p.z-jump.point.z;
  return { along:dx*jump.heading.x+dz*jump.heading.z,
    side:dx*jump.heading.z-dz*jump.heading.x };
}
export function jumpWorld(jump: DesertJump, along: number, side=0): Point {
  return { x:jump.point.x+along*jump.heading.x+side*jump.heading.z,
    z:jump.point.z+along*jump.heading.z-side*jump.heading.x };
}

/** Broad shoulder/landing shaping, with a real below-grade channel between. */
export function desertJumpOffset(p: Point): number {
  let offset=0;
  for(const jump of DESERT_JUMPS) {
    const {along,side}=jumpLocal(jump,p);
    if(along<-6||along>jump.landing+4||Math.abs(side)>4.5)continue;
    const cross=1-smooth(1.65,4.15,Math.abs(side));
    const lip=smooth(-4.1,-1,along)*(1-smooth(0,2.65,along));
    const landing=smooth(jump.landing-1.5,jump.landing-0.35,along)*
      (1-smooth(jump.landing+0.9,jump.landing+3.2,along));
    offset += cross*jump.height*(lip+landing*0.66);
    if(jump.kind==="gap") {
      // Dip extends smoothly below the original soil, its floor remains
      // climbable on a failed attempt rather than becoming a no-collision void.
      const channel=smooth(jump.gapStart-0.4,jump.gapStart+1.15,along)*
        (1-smooth(jump.gapEnd-0.8,jump.gapEnd+1.4,along));
      const bank=1-smooth(1.5,4.15,Math.abs(side));
      offset -= jump.depth*channel*bank;
    }
  }
  return offset;
}

/** World-space packed-earth bypass bends toward the outer shoulder of each gap.
 * Every point is below/away from the aerial line, then rejoins after runout. */
export function desertGapBypassPoints(jump: DesertJump): Point[] {
  if(jump.kind!=="gap")return [];
  const start=-5.5,end=jump.landing+4.5;
  // Keep the east-return detour *inland*, away from the lagoon shoreline.
  const sign=jump.id==="desert-step"?-1:1;
  return [jumpWorld(jump,start),jumpWorld(jump,-2.2,sign*2.8),
    jumpWorld(jump,0.5,sign*5.2),
    jumpWorld(jump,(jump.gapStart+jump.gapEnd)/2,sign*5.3),
    jumpWorld(jump,jump.gapEnd+0.6,sign*5.2),
    jumpWorld(jump,jump.landing+2,sign*2.8),
    jumpWorld(jump,end)];
}
const segmentDistance=(p:Point,a:Point,b:Point)=>{
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/Math.max(1e-8,dx*dx+dz*dz),0,1);
  return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
};
export function desertBypassDistance(p:Point):number {
  let best=Infinity;
  for(const jump of DESERT_JUMPS) {
    if(jump.kind!=="gap")continue;
    const path=desertGapBypassPoints(jump);
    for(let i=1;i<path.length;i++)
      best=Math.min(best,segmentDistance(p,path[i-1],path[i]));
  }
  return best;
}
/** Prevent saplings or roadside rocks in the walking/slow riding alternative. */
export function desertBypassClearance(p:Point):boolean {
  return p.x>=36&&p.x<=59&&p.z>=-52&&p.z<=-11&&
    desertBypassDistance(p)<1.65;
}
/** Decorative fallen wood is solid only while the player is on the ground;
 * high airborne riders may pass above it without a 2D collision wall. */
export const DESERT_GAP_DEBRIS = DESERT_JUMPS
  .filter(j=>j.obstacle==="fallen-joshua")
  .map(j=>({...jumpWorld(j,(j.gapStart+j.gapEnd)/2),radius:0.65}));


export function desertTrackHeightOffset(p: Point): number {
  if (p.x < 8 || p.x > 57 || p.z < -64 || p.z > 14) return 0;
  const frame = desertTrackFrame(p);
  if (frame.distance > 7) return 0;
  const tread = 1-smooth(1.1,3.5,frame.distance);
  let offset = -0.12*tread;
  if (frame.segment === "lower-turn-a" || frame.segment === "upper-turn" ||
      frame.segment === "lower-turn-b") {
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
  const main=1-smooth(1.5,3.5,desertTrackFrame(p).distance);
  const bypass=1-smooth(0.9,1.9,desertBypassDistance(p));
  return Math.max(main,bypass);
}
