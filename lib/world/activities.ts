import { constrainMove, distance, terrainHeight, type Obstacle, type Point } from './model';

export const ACTIVITIES = [
  { id: 'run', label: 'Run', name: 'Trail running', speed: 6.6, acceleration: 20, braking: 24, action: 'Jump', hint: 'Shift to sprint · Space to jump' },
  { id: 'skate', label: 'Skate', name: 'Skateboarding', speed: 11, acceleration: 8, braking: 5, action: 'Ollie', hint: 'Coast between pushes · Space to ollie' },
  { id: 'bike', label: 'Bike', name: 'Mountain biking', speed: 13, acceleration: 12, braking: 9, action: 'Hop', hint: 'Ride the trails · Space to bunny-hop' },
  { id: 'ski', label: 'Ski', name: 'Skiing', speed: 15, acceleration: 7, braking: 4, action: 'Hop', hint: 'Travels to snow · On foot below the ridge' },
  { id: 'boulder', label: 'Boulder', name: 'Bouldering', speed: 4.8, acceleration: 20, braking: 24, action: 'Climb', hint: 'Travels to the rocks · Space to climb' },
] as const;
export type Activity = typeof ACTIVITIES[number]['id'];
export const activityConfig = (id: Activity) => ACTIVITIES.find(a => a.id === id)!;
export const onSnow = (p: Point) => p.z < -17 && terrainHeight(p.x, p.z) > 6.8;
export const effectiveActivity = (id: Activity, p: Point): Activity => id === 'ski' && !onSnow(p) ? 'run' : id;
export const BOULDER_HOLDS = [
  { x: 16, z: -17, radius: 1.8, height: 1.5 },
  { x: 19, z: -19, radius: 1.6, height: 2.7 },
  { x: 22, z: -21, radius: 1.5, height: 4 },
];
export function groundHeight(p: Point) {
  let height = terrainHeight(p.x, p.z);
  for (const hold of BOULDER_HOLDS) {
    if (distance(p, hold) <= hold.radius) height = Math.max(height, terrainHeight(hold.x, hold.z) + hold.height);
  }
  return height;
}
export function nextHold(p: Point) {
  return BOULDER_HOLDS.find(h => distance(p, h) < 5 && groundHeight(h) > groundHeight(p) + 0.5);
}
export function activityLanding(id: Activity): Point | null {
  if (id === 'ski') return { x: 7, z: -33 };
  if (id === 'boulder') return { x: 13, z: -15 };
  return null;
}
export type Travel = { point: Point; speed: number; heading: Point };
/** Arcade locomotion in world units; no claim of physical sport simulation. */
export function stepTravel(current: Travel, input: Point, dt: number, selected: Activity, obstacles: Obstacle[], sprint = false, destination?: Point | null, airborne = 0): Travel {
  dt = Math.max(0, Math.min(dt, 0.05));
  const mode = effectiveActivity(selected, current.point);
  const config = activityConfig(mode);
  const length = Math.hypot(input.x, input.z);
  const moving = length > 0.001;
  const heading = moving ? { x: input.x / length, z: input.z / length } : current.heading;
  const slope = terrainHeight(current.point.x + heading.x, current.point.z + heading.z) - terrainHeight(current.point.x, current.point.z);
  const maxSpeed = config.speed * (mode === 'run' && sprint ? 1.45 : 1) * (mode === 'ski' ? Math.max(0.35, Math.min(1.4, 1 - slope * 0.4)) : 1);
  const speed = moving ? Math.min(maxSpeed, current.speed + config.acceleration * dt) : Math.max(0, current.speed - config.braking * dt);
  const step = Math.min(speed * dt, destination ? distance(current.point, destination) : Infinity);
  const point = constrainMove(current.point, { x: current.point.x + heading.x * step, z: current.point.z + heading.z * step }, obstacles);
  // Rock faces require a jump or the explicit boulder climb action.
  if (groundHeight(point) > groundHeight(current.point) + Math.max(0.6, airborne)) return { ...current, speed: 0 };
  return { point, heading, speed: distance(point, current.point) < step * 0.05 ? 0 : speed };
}
