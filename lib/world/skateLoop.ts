import type {Point} from "./model";
import {SKATE_LOOP} from "./skatepark";

export type SkateLoopRide={
 angle:number; speed:number; baseY:number; laneZ:number;
};
const TAU=2*Math.PI;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));

/** A swept crossing, not a proximity trigger. Riding away, drifting across,
 * standing still, or entering outside the actual planked width does nothing. */
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

/** This vertical ring has a two-dimensional projection onto the meadow.
 * The rider's wheel support and inversion are parametrized by arclength,
 * never by groundHeight(point), which only supports ordinary flat ground. */
export function skateLoopSample(ride:SkateLoopRide){
 const angle=clamp(ride.angle,0,TAU);
 const {center,radius}=SKATE_LOOP;
 return {
  point:{x:center.x-radius*Math.sin(angle),z:ride.laneZ},
  y:ride.baseY+radius*(1-Math.cos(angle)),
  pitch:-angle,
  // Tangential direction in x/y, with a continuous forward orientation.
  horizontalTangent:-Math.cos(angle),
 };
}

export function beginSkateLoop(speed:number,groundY:number,laneZ:number):SkateLoopRide{
 return {angle:0,speed:Math.max(0,speed),baseY:groundY+.09,laneZ};
}

/** Arcade-constrained contact with gravity along the tangent. Minimum entry
 * energy clears the crown; a small assisted contact floor handles discretized
 * rolling resistance at 20 FPS without sticking the avatar upside down.
 * The assist is limited to THIS track and never alters free-roam physics. */
export function advanceSkateLoop(
 start:SkateLoopRide,delta:number,
):{ride:SkateLoopRide;completed:boolean}{
 if(!Number.isFinite(delta)||delta<=0)return {ride:start,completed:false};
 let angle=clamp(start.angle,0,TAU),speed=Math.max(0,start.speed);
 const total=clamp(delta,0,.5);
 const slices=Math.ceil(total/.025);
 const step=total/slices;
 for(let i=0;i<slices&&angle<TAU;i++){
  speed=Math.max(3.9,speed+(-6.0*Math.sin(angle)-.14)*step);
  angle=Math.min(TAU,angle+speed*step/SKATE_LOOP.radius);
 }
 return {
  ride:{...start,angle,speed},
  completed:angle>=TAU-1e-9,
 };
}
