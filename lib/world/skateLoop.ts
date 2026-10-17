import type {Point} from "./model";
import {SKATE_LOOP} from "./skatepark";

export type SkateLoopRide={
 angle:number;speed:number;baseY:number;exitY:number;laneZ:number;
};
export const LOOP_TAU=2*Math.PI;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));

/** Only a fast westbound crossing of the entry seam engages track contact.
 * Proximity to its supports does not teleport the skater into the loop. */
export function skateLoopEntryCrossing(
 previous:Point,current:Point,heading:Point,speed:number,
):boolean{
 const {center,entryHalfWidth,minEntrySpeed}=SKATE_LOOP;
 if(!Number.isFinite(speed)||speed<minEntrySpeed||
  ![previous.x,previous.z,current.x,current.z,heading.x,heading.z].every(Number.isFinite))
  return false;
 const headingLength=Math.hypot(heading.x,heading.z);
 if(headingLength<.5||heading.x/headingLength>-.80)return false;
 const crossed=previous.x>center.x&&current.x<=center.x&&
  previous.x-center.x<1.15&&center.x-current.x<.75;
 const fraction=(previous.x-center.x)/(previous.x-current.x||1);
 const crossingZ=previous.z+(current.z-previous.z)*fraction;
 return crossed&&Math.abs(crossingZ-center.z)<=entryHalfWidth;
}

export function beginSkateLoop(speed:number,groundY:number,laneZ:number,
 exitGroundY=groundY):SkateLoopRide{
 return {angle:0,speed:Math.max(0,speed),baseY:groundY+.09,
  exitY:exitGroundY+.09,laneZ};
}

/** The sole geometry/physics authority for the skewed elliptical stunt.
 * East mouth is at cx; west mouth is at cx-exitOffset.
 * The seamless closed *rotation* is 360°, but the *path* has a distinct exit.
 * Noncircular tangent determines pitch, not an assumed circle angle. */
export function skateLoopSample(ride:SkateLoopRide){
 const angle=clamp(ride.angle,0,LOOP_TAU),t=angle/LOOP_TAU;
 const {center,radius,radiusY,exitOffset}=SKATE_LOOP;
 const dx=-radius*Math.cos(angle)-exitOffset/LOOP_TAU;
 const dy=radiusY*Math.sin(angle)+(ride.exitY-ride.baseY)/LOOP_TAU;
 let tilt=Math.atan2(dy,-dx);
 if(angle>Math.PI&&tilt<0)tilt+=LOOP_TAU;
 return {
  point:{x:center.x-radius*Math.sin(angle)-exitOffset*t,z:ride.laneZ},
  y:ride.baseY+radiusY*(1-Math.cos(angle))+
   (ride.exitY-ride.baseY)*t,
  pitch:-tilt,
  horizontalTangent:dx,
 };
}

/** Gravity-guided contact along an ellipse. Bounded slices prevent skipping
 * the inverted section on low-FPS devices. This assist is track-local only. */
export function advanceSkateLoop(
 start:SkateLoopRide,delta:number,
):{ride:SkateLoopRide;completed:boolean}{
 if(!Number.isFinite(delta)||delta<=0)return {ride:start,completed:false};
 let angle=clamp(start.angle,0,LOOP_TAU),speed=Math.max(0,start.speed);
 const total=clamp(delta,0,.5);
 const slices=Math.ceil(total/.025),step=total/slices;
 for(let i=0;i<slices&&angle<LOOP_TAU;i++){
  speed=Math.max(5.3,speed+(-6.0*Math.sin(angle)-.14)*step);
  const dx=-SKATE_LOOP.radius*Math.cos(angle)-
    SKATE_LOOP.exitOffset/LOOP_TAU;
  const dy=SKATE_LOOP.radiusY*Math.sin(angle)+
    (start.exitY-start.baseY)/LOOP_TAU;
  const ds=Math.max(.2,Math.hypot(dx,dy));
  angle=Math.min(LOOP_TAU,angle+speed*step/ds);
 }
 return {ride:{...start,angle,speed},completed:angle>=LOOP_TAU-1e-9};
}
