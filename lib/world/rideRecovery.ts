import {distance,isWater,terrainHeight,WORLD_BOUNDS,type Obstacle,type Point} from "./model";
import type {Activity} from "./activities";

/** Safety net for rider states; not a replacement for authentic ramp/rail physics.
 * Only call when movement is demonstrably blocked or after an invalid spawn. */
export type RideRecoveryState={
 blockedFor:number;
 anchor:Point;
 recoveries:number;
};
export const initialRideRecovery=(point:Point):RideRecoveryState=>({
 blockedFor:0,anchor:{...point},recoveries:0,
});
export const isRideMode=(mode:Activity)=>mode==="skate"||mode==="bike"||mode==="ski";

/** Airborne riders must not be pulled UP onto high, narrow support props
 * from underneath. Real deck/rail travel is still handled by its own
 * dedicated contact controller, so this guard only applies in free flight. */
export function airborneSupportHeight(
 playerY:number,groundY:number,naturalY:number,
):number{
 if(![playerY,groundY,naturalY].every(Number.isFinite))return naturalY;
 if(groundY-playerY>.55&&groundY-naturalY>1.35)
  return naturalY;
 return groundY;
}

const footprint=.51;
function clearOfProps(point:Point,obstacles:readonly Obstacle[]){
 return obstacles.every(o=>distance(point,o)>o.radius+footprint);
}
/** A stable place must have room for the rider, plausible local terrain and
 * no abrupt decorative beam / pillar top masquerading as a ski run. */
export function isSafeRideContact(
 point:Point,obstacles:readonly Obstacle[],
 height:(point:Point)=>number,
 natural:(point:Point)=>number=(p)=>terrainHeight(p.x,p.z),
):boolean{
 if(!Number.isFinite(point.x)||!Number.isFinite(point.z)||
  point.x<WORLD_BOUNDS.minX+1||point.x>WORLD_BOUNDS.maxX-1||
  point.z<WORLD_BOUNDS.minZ+1||point.z>WORLD_BOUNDS.maxZ-1||
  isWater(point)||!clearOfProps(point,obstacles))return false;
 const y=height(point),bed=natural(point);
 if(!Number.isFinite(y)||!Number.isFinite(bed)||y-bed>1.35)return false;
 const step=.75;
 for(const offset of [{x:step,z:0},{x:-step,z:0},
  {x:0,z:step},{x:0,z:-step}]){
  const sample={x:point.x+offset.x,z:point.z+offset.z};
  if(!Number.isFinite(natural(sample))||
    Math.abs(natural(sample)-bed)>2.15)return false;
 }
 return true;
}

/** Search is local and directional first, preserving a readable landing.
 * Only use a recent grounded checkpoint if the entire local ring fails. */
export function findRideRecoveryPoint(
 current:Point,heading:Point,previous:Point,
 obstacles:readonly Obstacle[],height:(p:Point)=>number,
 natural:(p:Point)=>number=(p)=>terrainHeight(p.x,p.z),
):Point|null{
 const norm=Math.hypot(heading.x,heading.z)||1;
 const fx=heading.x/norm,fz=heading.z/norm;
 const valid=(p:Point)=>isSafeRideContact(p,obstacles,height,natural);
 // Prefer a lateral slide out of an obstructing prop, then a small step
 // forwards/back. Bounded radii prevent teleporting across jump features.
 for(const r of [.95,1.65,2.55,3.6]){
  for(const [forward,side] of [[0,1],[0,-1],[-1,0],
   [-.7,.7],[-.7,-.7],[1,0],[.7,.7],[.7,-.7]]){
   const p={x:current.x+r*(fx*forward+fz*side),
    z:current.z+r*(fz*forward-fx*side)};
   if(valid(p))return p;
  }
 }
 return distance(current,previous)<18&&valid(previous)?{...previous}:null;
}

/** A stuck recovery requires sustained *intent* but almost no translation.
 * Ordinary idling, slow intentional exploration and active stunts do not
 * accumulate a timer. Use actual elapsed dt, bounded against tab stalls. */
export function advanceRideRecovery(
 state:RideRecoveryState,params:{
   point:Point;previous:Point;mode:Activity;dt:number;
   moving:boolean;grounded:boolean;controlledStunt:boolean;
   clear:boolean;
 },
):{state:RideRecoveryState;recover:boolean}{
 const {point,previous,mode,dt,moving,grounded,controlledStunt,clear}=params;
 if(!isRideMode(mode)||!grounded||controlledStunt||!moving){
  return {state:{...state,blockedFor:0},recover:false};
 }
 const progressed=distance(point,previous)>.012;
 const blockedFor=progressed?0:state.blockedFor+Math.max(0,Math.min(dt,.2));
 const anchor=progressed&&clear?{...point}:state.anchor;
 return {state:{...state,blockedFor},recover:blockedFor>=1.5};
}
