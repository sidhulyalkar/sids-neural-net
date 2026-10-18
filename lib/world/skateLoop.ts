import type {Point} from "./model";
import {SKATE_LOOP} from "./skatepark";
export type SkateLoopRide={angle:number;speed:number;baseY:number;exitY:number;laneZ:number};
export const LOOP_TAU=2*Math.PI;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function skateLoopEntryCrossing(previous:Point,current:Point,heading:Point,speed:number):boolean{
 const {center,entryHalfWidth,minEntrySpeed}=SKATE_LOOP;
 if(!Number.isFinite(speed)||speed<minEntrySpeed||
  ![previous.x,previous.z,current.x,current.z,heading.x,heading.z].every(Number.isFinite))return false;
 const length=Math.hypot(heading.x,heading.z);
 if(length<.5||heading.x/length>-.80)return false;
 const crossed=previous.x>center.x&&current.x<=center.x&&previous.x-current.x<4;
 const t=(previous.x-center.x)/(previous.x-current.x||1);
 return crossed&&Math.abs(previous.z+(current.z-previous.z)*t-center.z)<=entryHalfWidth;
}
export function beginSkateLoop(speed:number,groundY:number,laneZ:number,exitGroundY=groundY):SkateLoopRide{
 return {angle:0,speed:Math.max(0,speed),baseY:groundY+.035,exitY:exitGroundY+.035,laneZ};
}
/** Open 3D spiral. The two mouths are a full track width apart; its frame,
 * cedar skin and wheel contact use the same derivative, including lateral drift. */
export function skateLoopSample(ride:SkateLoopRide){
 const a=clamp(ride.angle,0,LOOP_TAU),t=a/LOOP_TAU;
 const {center,radius,radiusY,exitOffset,laneOffset}=SKATE_LOOP;
 const blend=t*t*(3-2*t),dBlend=6*t*(1-t)/LOOP_TAU;
 const dx=-radius*Math.cos(a)-exitOffset/LOOP_TAU;
 const dy=radiusY*Math.sin(a)+(ride.exitY-ride.baseY)*dBlend;
 const dz=laneOffset*(4*t-3*t*t)/LOOP_TAU;
 const ds=Math.hypot(dx,dy,dz),planar=Math.hypot(dx,dy);
 const forward:[number,number,number]=[dx/ds,dy/ds,dz/ds];
 const right:[number,number,number]=[-dx*dz/(planar*ds),-dy*dz/(planar*ds),planar/ds];
 const up:[number,number,number]=[dy/planar,-dx/planar,0];
 let tilt=Math.atan2(dy,-dx);
 if(tilt<a-Math.PI)tilt+=LOOP_TAU;
 else if(tilt>a+Math.PI)tilt-=LOOP_TAU;
 const horizontal=Math.hypot(dx,dz);
 const lateral=ride.laneZ-center.z;
 const curvature=(radius*Math.sin(a)*up[0]+(radiusY*Math.cos(a)+
  (ride.exitY-ride.baseY)*6*(1-2*t)/(LOOP_TAU*LOOP_TAU))*up[1])/(ds*ds);
 const wheelLift=Math.max(0,curvature*.63*.63*.5);
 return {point:{x:center.x-radius*Math.sin(a)-exitOffset*t+right[0]*lateral,
  z:center.z+laneOffset*t*t*(2-t)+right[2]*lateral},
  y:ride.baseY+radiusY*(1-Math.cos(a))+(ride.exitY-ride.baseY)*blend+right[1]*lateral,
  pitch:-tilt,wheelLift,horizontalTangent:dx,ds,dy,forward,right,up,
  heading:{x:dx/horizontal,z:dz/horizontal}};
}
/** Tangential gravity and rolling drag; no motor or minimum-speed floor.
 * Insufficient momentum rolls back down the entry. Small substeps preserve
 * contact and deterministic release even on slow frames. */
export function advanceSkateLoop(start:SkateLoopRide,delta:number):{
 ride:SkateLoopRide;completed:boolean;returned:boolean}{
 if(!Number.isFinite(delta)||delta<=0)return {ride:start,completed:false,returned:false};
 let ride={...start},returned=false;
 const total=clamp(delta,0,.5),slices=Math.ceil(total/.008),step=total/slices;
 for(let i=0;i<slices&&ride.angle<LOOP_TAU;i++){
  const p=skateLoopSample(ride);
  const acceleration=-3*p.dy/p.ds-.08*Math.sign(ride.speed);
  const speed=ride.speed+acceleration*step;
  const angle=ride.angle+(ride.speed+speed)*.5*step/p.ds;
  ride={...ride,speed,angle:clamp(angle,0,LOOP_TAU)};
  if(angle<=0&&speed<0){returned=true;break;}
 }
 return {ride,completed:ride.angle>=LOOP_TAU-1e-9,returned};
}

/** Look through the open side instead of the opaque descending timber skin. */
export function skateLoopCamera(ride:SkateLoopRide){
 const x=SKATE_LOOP.center.x-SKATE_LOOP.exitOffset*.5;
 return {position:{x:x+1,y:ride.baseY+SKATE_LOOP.radiusY+1.2,
  z:SKATE_LOOP.center.z-14},
  look:{x,y:ride.baseY+SKATE_LOOP.radiusY-.2,
   z:SKATE_LOOP.center.z+SKATE_LOOP.laneOffset*.5}};
}
