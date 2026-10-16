/** Minimal, deterministic disc-retrieval navigation.
 * Hold one obstacle-aware waypoint instead of picking a new detour at
 * every render frame (which produced zig-zags, shaky heading and cost).
 */
import type {Point} from "./model";
import {shastaDetour} from "./shastaMotion";
import {JET_SKI_PIER,jetSkiPierHeight} from "./jetSkiPier";
export type FetchRunRoute={
 goal:Point|null;waypoint:Point|null;detouring:boolean;
 lastCheck:number;decisions:number;
};
export const idleFetchRunRoute=():FetchRunRoute=>({
 goal:null,waypoint:null,detouring:false,lastCheck:0,decisions:0,
});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export function stepFetchRunRoute(
 route:FetchRunRoute,dog:Point,goal:Point,
 obstacles:readonly (Point & {radius:number})[],now:number,
):FetchRunRoute{
 const newGoal=!route.goal||distance(route.goal,goal)>.45;
 const arrived=route.detouring&&route.waypoint!==null&&
  distance(dog,route.waypoint)<1.45&&now-route.lastCheck>.3;
 const refresh=route.waypoint===null||newGoal||arrived||
  (!route.detouring&&now-route.lastCheck>.65);
 if(!refresh)return route;
 // Hole 2 begins on the pier. Shasta must leave by the same walkable
 // ramp as the player, not cut diagonally through open water to the green.
 const exitingPier=jetSkiPierHeight(dog)!==null&&
  jetSkiPierHeight(goal)===null&&dog.x>JET_SKI_PIER.landX+2.2;
 const waypoint=exitingPier?
  {x:JET_SKI_PIER.landX+.6,z:JET_SKI_PIER.centerZ}:
  shastaDetour(dog,goal,obstacles,1);
 const detouring=distance(waypoint,goal)>.5;
 return {goal:{...goal},waypoint,detouring,
  lastCheck:now,decisions:route.decisions+1};
}
/** Husky-like eager acceleration with a single gentle arrival envelope.
 * Navigation runs in XZ only; feet never inject vertical impulses.
 */
export function steerFetchRun(
 velocity:Point,dog:Point,waypoint:Point,goal:Point,dt:number,
):Point{
 const delta=Math.max(0,Math.min(.1,dt));
 const dx=waypoint.x-dog.x,dz=waypoint.z-dog.z;
 const distanceToWaypoint=Math.hypot(dx,dz);
 const distanceToGoal=distance(dog,goal);
 const speed=Math.min(11.5,
  Math.max(0,(distanceToGoal-1.15)*3.8),
  Math.max(0,(distanceToWaypoint-.18)*6.8));
 const inverse=distanceToWaypoint>1e-8?1/distanceToWaypoint:0;
 const vx=dx*inverse*speed,vz=dz*inverse*speed;
 const dvx=vx-velocity.x,dvz=vz-velocity.z;
 const change=Math.hypot(dvx,dvz);
 const currentSpeed=Math.hypot(velocity.x,velocity.z);
 const maxChange=(speed>currentSpeed?23:28)*delta;
 const ratio=change>maxChange&&change>1e-8?maxChange/change:1;
 return {x:velocity.x+dvx*ratio,z:velocity.z+dvz*ratio};
}
