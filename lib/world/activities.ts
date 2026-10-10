import { desertTrackClearance, DESERT_JUMPS } from "./desertTrack";
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
    action: "Ollie",
    hint: "Space near logs · Approach straight for 50-50, crosswise for boardslide",
  },
  {
    id: "bike",
    label: "Bike",
    name: "Mountain biking",
    speed: 13,
    acceleration: 12,
    braking: 9,
    action: "Hop",
    hint: "Ride the trails, sculpted dirt jumps and timber kickers",
  },
  {
    id: "ski",
    label: "Ski",
    name: "Skiing",
    speed: 15,
    acceleration: 7,
    braking: 4,
    action: "Hop",
    hint: "Snow follows ski mode · Space near fallen logs to slide",
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
  { x: 46, z: -21, radius: 1.8, height: 1.4 },
  { x: 47, z: -24, radius: 1.7, height: 2.8 },
  { x: 49, z: -27, radius: 1.6, height: 4.3 },
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
    a: { x: -6, z: -48 },
    b: { x: 5, z: -52 },
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
    a: { x: 3, z: -43 },
    b: { x: 10, z: -42 },
    role: "sport",
    radius: 0.38,
    lift: 0.54,
  },
  {
    id: "tree-run-slide",
    a: { x: -9, z: -61 },
    b: { x: -5, z: -55 },
    role: "sport",
    radius: 0.4,
    lift: 0.58,
  },
  {
    id: "alpine-snag",
    a: { x: -15, z: -53 },
    b: { x: -20, z: -49 },
    role: "scenery",
    radius: 0.38,
    lift: 0.4,
  },
  {
    id: "ridge-crossing",
    a: { x: 22, z: -48 },
    b: { x: 28, z: -47 },
    role: "traversal",
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

export const RIDE_RAMPS = [
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
export const SWIM_SPEED = 4.6;

export function groundHeight(p: Point) {
  let height = worldFloorHeight(p.x, p.z);
  if (isWater(p)) return height;
  for (const ramp of RIDE_RAMPS)
    height = Math.max(height, rampSurface(ramp, p) ?? -Infinity);
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
  // Ski begins on the higher Granite Ridge shoulder, upstream of the authored
  // kicker's launch direction. This makes the first descent naturally cross the
  // feature instead of approaching it from the back side.
  if (id === "ski") return { x: 8, z: -54 };
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
): Travel {
  dt = Math.max(0, Math.min(dt, 0.05));
  const mode = effectiveActivity(selected, current.point);
  const config = activityConfig(mode);
  const length = Math.hypot(input.x, input.z);
  const moving = length > 0.001;
  const heading = moving
    ? { x: input.x / length, z: input.z / length }
    : current.heading;
  const slope =
    supportHeight({ x: current.point.x + heading.x, z: current.point.z + heading.z }) -
    supportHeight(current.point);
  const maxSpeed =
    config.speed *
    (mode === "run" && sprint ? 1.45 : 1) *
    (mode === "ski" ? Math.max(0.42, Math.min(1.45, 1 - slope * 0.38)) : 1);
  const speed = moving
    ? Math.min(maxSpeed, current.speed + config.acceleration * dt)
    : Math.max(0, current.speed - config.braking * dt);
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
    obstacles,
  );
  if (
    !isWater(point) &&
    supportHeight(point) > supportHeight(current.point) + Math.max(0.6, airborne)
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
        log: (typeof FALLEN_LOGS)[number];
        t: number;
        point: Point;
        distance: number;
      }
    | undefined;
  for (const log of FALLEN_LOGS) {
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
  log: (typeof FALLEN_LOGS)[number],
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
    if (!ramp.modes.includes(mode)) continue;
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
    points: [
      { x: 32, z: -13 },
      { x: 32, z: -43 },
      { x: 37, z: -48 },
      { x: 42, z: -43 },
      { x: 42, z: -13 },
      { x: 37, z: -8 },
      { x: 32, z: -13 },
    ],
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
    desertTrackClearance(p) ||
    SPORT_ROUTES.some((r) =>
      r.points.slice(1).some((b, i) => lineDistance(r.points[i], b) < 3),
    ) ||
    RIDE_RAMPS.some((r) => {
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
