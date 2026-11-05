import { desertTrackClearance, desertTrackGroundRoute, DESERT_JUMPS } from "./desertTrack";
import {insideMeadowConnector,insideSkatePark,skateParkSurface,skateParkLipCrossing,redwoodBowlCarveHeading,SKATE_PARK_RAILS,SKATE_GROVE_FLOW,type SkateRail} from "./skatepark";
import {skateRollingSpeed} from "./skateDynamics";
import {airborneSupportHeight} from "./rideRecovery";
import { beamSupportHeight, technicalFeatureClearance } from "./technicalFeatures";
import { bigAirClearance } from "./bigAir";
import {jetSkiPierHeight} from "./jetSkiPier";
import {MOUNTAIN_HALFPIPE,withinMountainHalfpipe,suppressedFaceKicker,mountainHalfpipeApproachClearance,mountainSummitBoost} from "./mountainHalfpipe";
import {
  constrainMove,
  distance,
  isWater,
  terrainHeight,
  worldFloorHeight,
  type Obstacle,
  type Point,
} from "./model";

export const ACTIVITIES = [
  {
    id: "run",
    label: "Run",
    name: "Trail running",
    speed: 6.6,
    acceleration: 20,
    braking: 24,
    action: "Jump",
    hint: "Shift to sprint · Space to jump",
  },
  {
    id: "skate",
    label: "Skate",
    name: "Skateboarding",
    speed: 11,
    acceleration: 8,
    braking: 5,
    action: "Trick",
    hint: "WASD ride · Space easy trick (or grind near a rail) · Arrow Flick/manual/spins optional",
  },
  {
    id: "bike",
    label: "Bike",
    name: "Mountain biking",
    speed: 13,
    acceleration: 12,
    braking: 9,
    action: "Hop",
    hint: "Joshua ghost race · Aim and shoot targets for an extra burst of speed",
  },
  {
    id: "ski",
    label: "Ski",
    name: "Skiing",
    speed: 15,
    acceleration: 7,
    braking: 4,
    action: "Hop",
    hint: "Snow and mountain jumps · Aim and shoot glowing rings for speed boosts",
  },
  {
    id: "boulder",
    label: "Boulder",
    name: "Bouldering",
    speed: 4.8,
    acceleration: 20,
    braking: 24,
    action: "Climb",
    hint: "Travels to the rocks · Space to climb",
  },
] as const;

export type Activity = (typeof ACTIVITIES)[number]["id"];
export const activityConfig = (id: Activity) =>
  ACTIVITIES.find((a) => a.id === id)!;

export const onSnow = (p: Point) =>
  !isWater(p) && p.z < -31 && terrainHeight(p.x, p.z) > 9;

/** Ski mode remains equipped everywhere; the snowfall is a mode effect, not a biome gate. */
export const effectiveActivity = (id: Activity, _p: Point): Activity => id;

/** Jointed granite ledges on the eastern side of Joshua basin. */
export const DESERT_CLIMB_HOLDS = [
  // Separate granite shoulder climbing zone, west of the bike through-lines.
  { x: 20, z: -39, radius: 1.8, height: 1.4 },
  { x: 20, z: -42, radius: 1.7, height: 2.8 },
  { x: 19, z: -45, radius: 1.6, height: 4.3 },
];

export const GROVE_CLIMB_HOLDS = [
  { x: 16, z: -17, radius: 1.8, height: 1.5 },
  { x: 19, z: -19, radius: 1.6, height: 2.7 },
  { x: 22, z: -21, radius: 1.5, height: 4 },
];
export const BOULDER_HOLDS = [...GROVE_CLIMB_HOLDS, ...DESERT_CLIMB_HOLDS];

export const FALLEN_LOGS = [
  {
    id: "grove-log",
    a: { x: -7, z: 2 },
    b: { x: 3, z: 1 },
    role: "sport",
    radius: 0.48,
    lift: 0.62,
  },
  {
    id: "trail-log",
    a: { x: 13, z: -9 },
    b: { x: 22, z: -14 },
    role: "sport",
    radius: 0.42,
    lift: 0.58,
  },
  {
    id: "ridge-log",
    a: { x: 12.4, z: -65 },
    b: { x: 13, z: -70 },
    role: "sport",
    radius: 0.5,
    lift: 0.7,
  },
  {
    id: "grove-long",
    a: { x: -17, z: -5 },
    b: { x: -10, z: -12 },
    role: "sport",
    radius: 0.5,
    lift: 0.65,
  },
  {
    id: "grove-deadwood",
    a: { x: -15, z: 29 },
    b: { x: -7, z: 32 },
    role: "scenery",
    radius: 0.7,
    lift: 0.72,
  },
  {
    id: "fern-nurse",
    a: { x: -9, z: 23 },
    b: { x: -4, z: 25 },
    role: "scenery",
    radius: 0.4,
    lift: 0.4,
  },
  {
    id: "bowl-slide",
    a: { x: 14, z: -72 },
    b: { x: 13, z: -77 },
    role: "sport",
    radius: 0.38,
    lift: 0.54,
  },
  {
    id: "tree-run-slide",
    a: { x: 19.7, z: -64 },
    b: { x: 21, z: -70 },
    role: "sport",
    radius: 0.4,
    lift: 0.58,
  },
  {
    id: "alpine-snag",
    a: { x: 17, z: -73 },
    b: { x: 17.5, z: -76 },
    role: "scenery",
    radius: .38,
    lift: .26,
  },
  {
    id: "ridge-crossing",
    a: { x: 21, z: -72 },
    b: { x: 23, z: -77 },
    role: "sport",
    radius: 0.5,
    lift: 0.65,
  },
  {
    id: "rainforest-log",
    a: { x: 38, z: 39 },
    b: { x: 45, z: 42 },
    role: "scenery",
    radius: 0.6,
    lift: 0.65,
  },
  {
    id: "lower-bike-log",
    a: { x: 6, z: -18 },
    b: { x: 10, z: -21 },
    role: "sport",
    radius: 0.32,
    lift: 0.48,
  },
] as const;

// Surface-only log lines on the shoulders of the arcade roof.
export const backsideLogs = FALLEN_LOGS.filter(log =>
  ["ridge-log","bowl-slide","tree-run-slide","ridge-crossing"].includes(log.id));

export function timberTop(log: (typeof FALLEN_LOGS)[number], t:number) {
  const entry = terrainHeight(log.a.x,log.a.z) + .035;
  const tip = terrainHeight(log.b.x,log.b.z) + 1.05;
  return entry + (tip-entry)*t;
}

// A forward grind can carry into the second trunk on either shoulder.
const timberReceivers: Record<string, string> = {
  "ridge-log": "bowl-slide",
  "tree-run-slide": "ridge-crossing",
};

export function timberTransfer(id: string, speed: number) {
  const start = backsideLogs.find(log => log.id === id);
  const receiver = backsideLogs.find(log => log.id === timberReceivers[id]);
  if (!start || !receiver || speed < 4) return null;
  const t = .48;
  const dx = receiver.a.x + (receiver.b.x - receiver.a.x) * t - start.b.x;
  const dz = receiver.a.z + (receiver.b.z - receiver.a.z) * t - start.b.z;
  const distance = Math.hypot(dx, dz);
  const duration = distance / speed;
  const drop = timberTop(receiver, t) - timberTop(start, 1);
  return {
    heading: { x: dx / distance, z: dz / distance },
    verticalSpeed: drop / duration + 7 * duration,
  };
}

export function timberLanding(point: Point, heading: Point, fromY: number, toY: number) {
  if (point.z > -70 || point.z < -78 || toY >= fromY) return null;
  for (const log of backsideLogs) {
    if (!Object.values(timberReceivers).includes(log.id)) continue;
    const dx = log.b.x - log.a.x, dz = log.b.z - log.a.z;
    const length = Math.hypot(dx, dz);
    if ((heading.x * dx + heading.z * dz) / length < .55) continue;
    const t = ((point.x - log.a.x) * dx + (point.z - log.a.z) * dz) / (length * length);
    if (t <= 0 || t >= 1) continue;
    const x = log.a.x + t * dx, z = log.a.z + t * dz;
    const y = timberTop(log, t);
    if (Math.hypot(point.x - x, point.z - z) <= log.radius && fromY >= y && toY <= y)
      return { log, t, point: { x, z }, y };
  }
  return null;
}

export function timberExit(from:Point,to:Point,speed:number) {
  if(speed<4 || from.z > -63 || from.z < -79)return null;
  for(const log of backsideLogs){
    const dx=log.b.x-log.a.x,dz=log.b.z-log.a.z;
    const length=Math.hypot(dx,dz);
    const before=((from.x-log.b.x)*dx+(from.z-log.b.z)*dz)/length;
    const after=((to.x-log.b.x)*dx+(to.z-log.b.z)*dz)/length;
    if(before>=0 || after<0)continue;
    const fraction=-before/(after-before);
    const x=from.x+(to.x-from.x)*fraction,z=from.z+(to.z-from.z)*fraction;
    if(Math.hypot(x-log.b.x,z-log.b.z)<=log.radius)return log;
  }
  return null;
}

function timberSupport(p:Point) {
  if(p.z > -63 || p.z < -79) return -Infinity;
  let y=-Infinity;
  for(const log of backsideLogs){
    const dx=log.b.x-log.a.x,dz=log.b.z-log.a.z;
    const t=((p.x-log.a.x)*dx+(p.z-log.a.z)*dz)/(dx*dx+dz*dz);
    if(t<0||t>1)continue;
    const offset=Math.hypot(p.x-log.a.x-t*dx,p.z-log.a.z-t*dz);
    if(offset<=log.radius) y=Math.max(y,timberTop(log,t));
  }
  return y;
}

export const RIDE_RAMPS = [
  {id:"sequoia-return-kicker",point:{x:-7.1,z:57},radius:1.25,
   heading:{x:0,z:-1},lift:2.2,modes:["skate","bike"] as Activity[]},
  {id:"grove-home-kicker",point:{x:-6.8,z:53.3},radius:1.1,
   heading:{x:.1,z:-1},lift:2,modes:["skate","bike"] as Activity[]},
  {
    id: "skate-ramp",
    point: { x: -3, z: 13 },
    radius: 2.2,
    heading: { x: 1, z: -0.15 },
    lift: 4.1,
    modes: ["skate", "bike"] as Activity[],
  },
  {
    id: "bike-ramp",
    point: { x: 10, z: -28 },
    radius: 2.5,
    heading: { x: -0.15, z: 1 },
    lift: 5.3,
    modes: ["bike", "skate"] as Activity[],
  },
  {
    id: "ski-kicker",
    // The open bowl shoulder keeps takeoff and landing clear of the cave cut.
    point: { x: 8, z: -47 },
    radius: 2.8,
    heading: { x: 0, z: 1 },
    lift: 6.1,
    modes: ["ski", "bike"] as Activity[],
  },
  {
    id: "bowl-small",
    point: { x: 1, z: -51 },
    radius: 2,
    heading: { x: 0, z: 1 },
    lift: 3.2,
    modes: ["ski", "bike"] as Activity[],
  },
  {
    id: "bowl-medium",
    point: { x: 1, z: -37 },
    radius: 2.4,
    heading: { x: 0, z: 1 },
    lift: 4.4,
    modes: ["ski", "bike"] as Activity[],
  },
  {
    id: "bowl-large",
    point: { x: 1, z: -22 },
    radius: 2.8,
    heading: { x: 0, z: 1 },
    lift: 5.6,
    modes: ["ski", "bike"] as Activity[],
  },
  {
    id: "tree-kicker",
    point: { x: -9, z: -44 },
    radius: 2,
    heading: { x: 0, z: 1 },
    lift: 3.8,
    modes: ["ski", "bike"] as Activity[],
  },
  {
    id: "grove-flow",
    point: { x: -11, z: 15 },
    radius: 2,
    heading: { x: 0, z: -1 },
    lift: 3.5,
    modes: ["skate", "bike"] as Activity[],
  },
  {
    id: "scrub-roller",
    point: { x: 23, z: 22 },
    radius: 2,
    heading: { x: 0, z: 1 },
    lift: 3.2,
    modes: ["skate", "bike"] as Activity[],
  },
  ...DESERT_JUMPS.map((jump) => ({
    id: jump.id,
    point: jump.point,
    heading: jump.heading,
    radius: 2,
    lift: jump.lift,
    modes: ["bike", "skate"] as Activity[],
  })),
] as const;

export type AquaticMode = "land" | "surface" | "dive";
export type GrindStyle = "fifty-fifty" | "boardslide";
export type GrindRail = SkateRail | (typeof FALLEN_LOGS)[number];
export const SWIM_SPEED = 4.6;

export function groundHeight(p: Point) {
  const pier=jetSkiPierHeight(p);
  if(pier!==null)return pier;
  let height = Math.max(worldFloorHeight(p.x, p.z),timberSupport(p));
  if (isWater(p)) return height;
  for (const ramp of RIDE_RAMPS){
    // Older timber kickers occupying the newly carved snow corridor must
    // not keep invisible airborne support after their art is hidden.
    if(suppressedFaceKicker(ramp.id))continue;
    height = Math.max(height, rampSurface(ramp, p) ?? -Infinity);
  }
  height = Math.max(height, skateParkSurface(p) ?? -Infinity);
  const beam = beamSupportHeight(p, terrainHeight(p.x,p.z));
  if (beam !== null) height = Math.max(height, beam);
  for (const hold of BOULDER_HOLDS) {
    if (distance(p, hold) <= hold.radius)
      height = Math.max(height, terrainHeight(hold.x, hold.z) + hold.height);
  }
  return height;
}

export function nextHold(p: Point) {
  return BOULDER_HOLDS.find(
    (h) => distance(p, h) < 5 && groundHeight(h) > groundHeight(p) + 0.5,
  );
}

export function activityLanding(id: Activity): Point | null {
  // The ordinary Skiing button starts on a dry, high snow approach to the
  // *single* downhill halfpipe. It does not arm the separate Ski Jump game.
  if (id === "ski") return {
    x:MOUNTAIN_HALFPIPE.centerX,
    z:MOUNTAIN_HALFPIPE.startZ-1.65,
  };
  if (id === "skate") return {...SKATE_GROVE_FLOW.approach};
  if (id === "boulder") return { x: 13, z: -15 };
  return null;
}

export type Travel = { point: Point; speed: number; heading: Point };

/** Arcade locomotion in world units; no claim of physical sport simulation. */
export function stepTravel(
  current: Travel,
  input: Point,
  dt: number,
  selected: Activity,
  obstacles: Obstacle[],
  sprint = false,
  destination?: Point | null,
  airborne = 0,
  supportHeight: (p: Point) => number = groundHeight,
  boost = false,
  riderY = NaN,
): Travel {
  dt = Math.max(0, Math.min(dt, 0.05));
  const mode = effectiveActivity(selected, current.point);
  const config = activityConfig(mode);
  const length = Math.hypot(input.x, input.z);
  const moving = length > 0.001;
  const desired = moving
    ? { x: input.x / length, z: input.z / length }
    : current.heading;
  // Rolling skateboard carves gradually; other modes keep exact steering.
  const steer = mode === "skate" ? Math.min(1, dt * (3.1 + current.speed * 0.16)) : 1;
  const blended = {x:current.heading.x*(1-steer)+desired.x*steer,
    z:current.heading.z*(1-steer)+desired.z*steer};
  const norm = Math.hypot(blended.x,blended.z) || 1;
  const unbanked={x:blended.x/norm,z:blended.z/norm};
  const heading=mode==="skate"?
    redwoodBowlCarveHeading(current.point,unbanked,current.speed,dt):unbanked;
  // A ski jump can be exited into Run in midair. Airborne contact must
  // remain geometrically consistent across that activity transition.
  const aboveShortProp=airborne>.2&&Number.isFinite(riderY);
  // The same contact rule must control both speed-grade and climb blocking.
  // Otherwise a high beam "above" the airborne rider can still brake them
  // to a dead stop even though their trunk collision was correctly skipped.
  const contactSupport=(p:Point)=>{
    const y=supportHeight(p);
    return aboveShortProp?airborneSupportHeight(riderY,y,
      terrainHeight(p.x,p.z)):y;
  };
  const slope =
    contactSupport({ x: current.point.x + heading.x, z: current.point.z + heading.z }) -
    contactSupport(current.point);
  const boostEligible=boost && (mode==="bike"||mode==="ski"||mode==="skate");
  const maxSpeed =
    config.speed *
    (mode === "run" && sprint ? 1.45 : 1) *
    (mode === "ski" ? Math.max(0.42, Math.min(1.45, 1 - slope * 0.38)) : 1) *
    (boostEligible ? 1.6 : 1);
  // When the skill-shot expires, retain momentum briefly instead of snapping
  // immediately to normal cruise speed. Normal braking still takes over.
  // In the pipe, steering in the air redirects the retained takeoff speed.
  // Ground acceleration resumes when the skis meet the snow again.
  const speed = mode==="ski" && airborne>0 && (withinMountainHalfpipe(current.point) ||
      (current.point.z <= -64 && current.point.z >= -78 && current.point.x >= 9 && current.point.x <= 24))
    ? current.speed
    : mode==="skate"
    ? skateRollingSpeed({
      speed:current.speed,dt,pushing:moving,riseAhead:slope,
      maxSpeed,boosted:boostEligible,
    })
    : moving
    ? Math.min(Math.max(maxSpeed,current.speed-config.braking*dt*.75),
      current.speed+config.acceleration*dt*(boostEligible?2.35:1))
    : Math.max(0,current.speed-config.braking*dt);
  const step = Math.min(
    speed * dt,
    destination ? distance(current.point, destination) : Infinity,
  );
  // Finite trunks/rocks are solid near ground yet legitimately passable
  // above their visual top during jumps. Cave walls (no topY) stay solid.
  const contactObstacles=aboveShortProp?
    obstacles.filter(o=>o.topY===undefined||riderY<=o.topY+.45):
    obstacles;
  const point = constrainMove(
    current.point,
    {
      x: current.point.x + heading.x * step,
      z: current.point.z + heading.z * step,
    },
    contactObstacles,
  );
  if (
    (!isWater(point)||jetSkiPierHeight(point)!==null) &&
    !(mode === "ski" && mountainHalfpipeApproachClearance(point) &&
      mountainHalfpipeApproachClearance(current.point) &&
      Math.abs(contactSupport(point)-terrainHeight(point.x,point.z))<.01 &&
      Math.abs(contactSupport(current.point)-terrainHeight(current.point.x,current.point.z))<.01) &&
    contactSupport(point) > contactSupport(current.point) + Math.max(0.6, airborne)
  )
    return { ...current, speed: 0 };
  return {
    point,
    heading,
    speed: distance(point, current.point) < step * 0.05 ? 0 : speed,
  };
}

export function stepSwim(
  current: Travel,
  input: Point,
  dt: number,
  destination?: Point | null,
): Travel {
  // Swimming has no trunk/ledge collision and uses swept world-bound clamping,
  // so it can safely retain more wall-clock time on a slow renderer than land
  // locomotion. This prevents low-FPS devices from turning the ocean into slow motion.
  dt = Math.max(0, Math.min(dt, 0.12));
  const length = Math.hypot(input.x, input.z);
  const moving = length > 0.001;
  const heading = moving
    ? { x: input.x / length, z: input.z / length }
    : current.heading;
  const speed = moving
    ? Math.min(SWIM_SPEED, current.speed + 6.5 * dt)
    : Math.max(0, current.speed - 7 * dt);
  const step = Math.min(
    speed * dt,
    destination ? distance(current.point, destination) : Infinity,
  );
  const point = constrainMove(
    current.point,
    {
      x: current.point.x + heading.x * step,
      z: current.point.z + heading.z * step,
    },
    [],
  );
  return {
    point,
    heading,
    speed: distance(point, current.point) < step * 0.05 ? 0 : speed,
  };
}

export function terrainContact(
  point: Point,
  heading: Point,
  halfLength: number,
  halfWidth: number,
  supportHeight: (p: Point) => number = groundHeight,
) {
  const magnitude = Math.max(1e-6, Math.hypot(heading.x, heading.z));
  const forward = { x: heading.x / magnitude, z: heading.z / magnitude };
  const right = { x: forward.z, z: -forward.x };
  const sample = (along: number, side: number) =>
    supportHeight({
      x: point.x + forward.x * along + right.x * side,
      z: point.z + forward.z * along + right.z * side,
    });
  const front = sample(halfLength, 0);
  const rear = sample(-halfLength, 0);
  const rightY = sample(0, halfWidth);
  const leftY = sample(0, -halfWidth);
  const center = supportHeight(point);
  return {
    pitch: -Math.atan2(front - rear, Math.max(0.01, halfLength * 2)),
    roll: Math.atan2(rightY - leftY, Math.max(0.01, halfWidth * 2)),
    support: Math.max(center, front, rear, rightY, leftY),
  };
}

export function nearestGrind(point: Point, maxDistance = 1.45) {
  let best:
    | {
        log: GrindRail;
        t: number;
        point: Point;
        distance: number;
      }
    | undefined;
  for (const log of [...FALLEN_LOGS,...SKATE_PARK_RAILS]) {
    if (log.role !== "sport") continue;
    const dx = log.b.x - log.a.x,
      dz = log.b.z - log.a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - log.a.x) * dx + (point.z - log.a.z) * dz) / lengthSquared,
      ),
    );
    const closest = { x: log.a.x + dx * t, z: log.a.z + dz * t };
    const d = distance(point, closest);
    if (d <= maxDistance && (!best || d < best.distance))
      best = { log, t, point: closest, distance: d };
  }
  return best;
}

export function grindStyleForApproach(
  heading: Point,
  log: GrindRail,
): GrindStyle {
  const headingLength = Math.max(1e-6, Math.hypot(heading.x, heading.z));
  const logX = log.b.x - log.a.x;
  const logZ = log.b.z - log.a.z;
  const logLength = Math.max(1e-6, Math.hypot(logX, logZ));
  const alignment = Math.abs(
    (heading.x * logX + heading.z * logZ) / (headingLength * logLength),
  );
  // Within 45° of the log stays longitudinal; a more crosswise landing becomes
  // a boardslide/side-slide. This is shared by skateboard and skis.
  return alignment >= Math.SQRT1_2 ? "fifty-fifty" : "boardslide";
}

export function rampImpulseAt(
  point: Point,
  heading: Point,
  mode: Activity,
  speed: number,
) {
  if (speed < 3) return null;
  const headingLength = Math.max(1e-6, Math.hypot(heading.x, heading.z));
  for (const ramp of RIDE_RAMPS) {
    if(suppressedFaceKicker(ramp.id))continue;
    if (!ramp.modes.includes(mode)) continue;
    const desert = DESERT_JUMPS.find(j => j.id === ramp.id);
    if(desert?.kind === "gap" && speed < desert.minSpeed) continue;
    const rampLength = Math.hypot(ramp.heading.x, ramp.heading.z);
    const fx = ramp.heading.x / rampLength,
      fz = ramp.heading.z / rampLength;
    const dx = point.x - ramp.point.x,
      dz = point.z - ramp.point.z;
    const along = dx * fx + dz * fz,
      side = dx * fz - dz * fx;
    // A short strip straddling the lip catches a full 50 ms physics step at
    // maximum ski speed without launching from beside or halfway up the deck.
    if (along < -0.45 || along > 0.65 || Math.abs(side) > 1.275) continue;
    const dot =
      (heading.x * ramp.heading.x + heading.z * ramp.heading.z) /
      (headingLength * rampLength);
    if (dot < 0.25) continue;
    return { id: ramp.id, impulse: Math.min(9, ramp.lift + speed * 0.16) };
  }
  return null;
}

/**
 * Actual gap launches use a swept lip crossing. Stopping at or backing onto
 * a gap lip cannot create repeated upward impulses or an invisible trampoline.
 * Existing non-gap ramps retain their original behavior.
 */
export function rampImpulseCrossing(
  previous:Point, current:Point, heading:Point, mode:Activity, speed:number,
) {
  if(mode==="skate"){
    const parkLip=skateParkLipCrossing(previous,current,heading,speed);
    if(parkLip)return parkLip;
  }
  for(const jump of DESERT_JUMPS) {
    if(jump.kind!=="gap")continue;
    const prev=(previous.x-jump.point.x)*jump.heading.x+
      (previous.z-jump.point.z)*jump.heading.z;
    const along=(current.x-jump.point.x)*jump.heading.x+
      (current.z-jump.point.z)*jump.heading.z;
    const lateral=(current.x-jump.point.x)*jump.heading.z-
      (current.z-jump.point.z)*jump.heading.x;
    // A real crossed plane, one frame's 50ms maximum step either side.
    if(prev<0 && along>=0 && along<=0.68 && Math.abs(lateral)<=1.275) {
      const hit=rampImpulseAt(current,heading,mode,speed);
      if(hit?.id===jump.id)return hit;
    }
  }
  const nearest=DESERT_JUMPS.some(j=>j.kind==="gap" && Math.hypot(
    current.x-j.point.x,current.z-j.point.z)<2);
  return nearest?null:rampImpulseAt(current,heading,mode,speed);
}

/** Integrate height in world space so downhill terrain cannot drag a jump down. */
export function stepAirborne(
  previousY: number,
  verticalSpeed: number,
  groundY: number,
  dt: number,
) {
  dt = Math.max(0, Math.min(dt, 0.05));
  const speed = verticalSpeed - 14 * dt;
  const y = Math.max(groundY, previousY + speed * dt);
  const airHeight = y - groundY;
  return { y, verticalSpeed: airHeight > 0 ? speed : 0, airHeight };
}

/** Authored travel lanes also reserve landing/runout space from scenery. */
export const SPORT_ROUTES = [
  {
    id: "open-bowl",
    points: [
      { x: 1, z: -59 },
      { x: 1, z: -51 },
      { x: 1, z: -37 },
      { x: 1, z: -22 },
      { x: 1, z: -8 },
    ],
  },
  {
    id: "tree-run",
    points: [
      { x: -9, z: -65 },
      { x: -9, z: -44 },
      { x: -9, z: -29 },
    ],
  },
  {
    id: "technical-chute",
    points: [
      { x: 22, z: -65 },
      { x: 26, z: -54 },
      { x: 26, z: -35 },
    ],
  },
  {
    id: "lower-bike",
    points: [
      { x: 10, z: -28 },
      { x: 8, z: -19 },
      { x: -3, z: 13 },
    ],
  },
  {
    id: "grove-loop",
    points: [
      { x: -11, z: 23 },
      { x: -11, z: 15 },
      { x: -11, z: -1 },
    ],
  },
  {
    id: "desert-flow",
    // One complete measured lap, shared with terrain and landscaping.
    points: desertTrackGroundRoute(36),
  },
] as const;
export function sportClearance(p: Point) {
  const lineDistance = (a: Point, b: Point) => {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
    );
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  };
  return (
    insideSkatePark(p,2) || insideMeadowConnector(p,2) ||
    mountainHalfpipeApproachClearance(p) || mountainSummitBoost(p)>.025 ||
    desertTrackClearance(p) ||
    technicalFeatureClearance(p) ||
    bigAirClearance(p) ||
    SPORT_ROUTES.some((r) =>
      r.id !== "desert-flow" && r.points.slice(1).some((b, i) => lineDistance(r.points[i], b) < 3),
    ) ||
    RIDE_RAMPS.some((r) => {
      if(suppressedFaceKicker(r.id))return false;
      const len = Math.hypot(r.heading.x, r.heading.z);
      return (
        lineDistance(
          {
            x: r.point.x - (r.heading.x / len) * 5,
            z: r.point.z - (r.heading.z / len) * 5,
          },
          {
            x: r.point.x + (r.heading.x / len) * 13,
            z: r.point.z + (r.heading.z / len) * 13,
          },
        ) < 3.5
      );
    })
  );
}

/** Plank surface and support use the same sloped deck, ending at the launch point. */
export function rampSurface(ramp: (typeof RIDE_RAMPS)[number], p: Point) {
  // Once a timber kicker has been removed from the ski-face scene, its
  // exported support query must not resurrect a phantom deck either.
  if(suppressedFaceKicker(ramp.id))return null;
  // The Joshua step is earthen terrain, not a disconnected timber platform.
  if (ramp.id.startsWith("desert-")) return null;
  const len = Math.hypot(ramp.heading.x, ramp.heading.z),
    fx = ramp.heading.x / len,
    fz = ramp.heading.z / len;
  const dx = p.x - ramp.point.x,
    dz = p.z - ramp.point.z,
    along = dx * fx + dz * fz,
    side = dx * fz - dz * fx;
  if (along < -3.5 || along > 0 || Math.abs(side) > 1.275) return null;
  const t = (along + 3.5) / 3.5;
  const entry =
    terrainHeight(ramp.point.x - fx * 3.5, ramp.point.z - fz * 3.5) + 0.12;
  const lip = terrainHeight(ramp.point.x, ramp.point.z) + 0.84;
  return entry + (lip - entry) * t;
}
