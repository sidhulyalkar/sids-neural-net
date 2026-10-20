import type {Point} from "./model";
import {SKATE_LOOP} from "./skatepark";
export type SkateLoopRide={angle:number;speed:number;baseY:number;exitY:number;laneZ:number;direction?:1|-1;entryLateralSpeed?:number};
export const LOOP_TAU=2*Math.PI;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export function skateLoopEntryCrossing(previous:Point,current:Point,heading:Point,speed:number):boolean{
 return skateLoopEntryDirection(previous,current,heading,speed)!==0;
}
/** Return the mouth crossed, using its actual tangent and separated lane. */
export function skateLoopEntryDirection(previous:Point,current:Point,heading:Point,speed:number):0|1|-1{
 if(!Number.isFinite(speed)||speed<SKATE_LOOP.minEntrySpeed||
  ![previous.x,previous.z,current.x,current.z,heading.x,heading.z].every(Number.isFinite))return 0;
 const len=Math.hypot(heading.x,heading.z);
 if(len<.5||Math.hypot(current.x-previous.x,current.z-previous.z)>4)return 0;
 for(const direction of [1,-1] as const){
  const r=beginSkateLoop(speed,0,SKATE_LOOP.center.z,0,direction);
  const pose=skateLoopSample(r),h=pose.heading;
  if((heading.x*h.x+heading.z*h.z)/len<.42)continue;
  const before=(previous.x-pose.point.x)*h.x+(previous.z-pose.point.z)*h.z;
  const after=(current.x-pose.point.x)*h.x+(current.z-pose.point.z)*h.z;
  if(before>=0||after<0)continue;
  const t=-before/(after-before);
  const x=previous.x+(current.x-previous.x)*t-pose.point.x;
  const z=previous.z+(current.z-previous.z)*t-pose.point.z;
  if(Math.abs(x*h.z-z*h.x)<=SKATE_LOOP.entryHalfWidth)return direction;
 }
 return 0;
}

export function beginSkateLoop(speed:number,groundY:number,laneZ:number,exitGroundY=groundY,direction:1|-1=1):SkateLoopRide{
 return {angle:direction===1?0:LOOP_TAU,speed:direction*Math.max(0,speed),direction,baseY:groundY+.035,exitY:exitGroundY+.035,laneZ};
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

 const lateral=ride.laneZ-center.z;
 const curvature=(radius*Math.sin(a)*up[0]+(radiusY*Math.cos(a)+
  (ride.exitY-ride.baseY)*6*(1-2*t)/(LOOP_TAU*LOOP_TAU))*up[1])/(ds*ds);
 const wheelLift=Math.max(0,curvature*.63*.63*.5);
 const direction=ride.direction??1;
 if(direction===-1){for(let i=0;i<3;i++){forward[i]*=-1;right[i]*=-1;}}
 const positionRight=[...right];
 const lateralSpeed=(ride.entryLateralSpeed??0)*direction;
 if(Math.abs(lateralSpeed)>.001){
  const along=Math.abs(ride.speed),length=Math.hypot(along,lateralSpeed);
  for(let i=0;i<3;i++)forward[i]=(forward[i]*along+right[i]*lateralSpeed)/length;
  const adjusted=[up[1]*forward[2]-up[2]*forward[1],up[2]*forward[0]-up[0]*forward[2],up[0]*forward[1]-up[1]*forward[0]];
  for(let i=0;i<3;i++)right[i]=adjusted[i];
 }
 return {point:{x:center.x-radius*Math.sin(a)-exitOffset*t+positionRight[0]*lateral*direction,
  z:center.z+laneOffset*t*t*(2-t)+positionRight[2]*lateral*direction},
  y:ride.baseY+radiusY*(1-Math.cos(a))+(ride.exitY-ride.baseY)*blend+positionRight[1]*lateral*direction,
  pitch:-tilt,wheelLift,horizontalTangent:dx,ds,dy,forward,right,up,
  heading:{x:forward[0]/(Math.hypot(forward[0],forward[2])||1),z:forward[2]/(Math.hypot(forward[0],forward[2])||1)}};
}
/** Tangential gravity and rolling drag; no motor or minimum-speed floor.
 * Insufficient momentum rolls back down the entry. Small substeps preserve
 * contact and deterministic release even on slow frames. */
export function advanceSkateLoop(start:SkateLoopRide,delta:number):{
 ride:SkateLoopRide;completed:boolean;returned:boolean}{
 if(!Number.isFinite(delta)||delta<=0)return {ride:start,completed:false,returned:false};
 let ride={...start},returned=false,completed=false;
 const direction=start.direction??1;
 const total=clamp(delta,0,.5),slices=Math.ceil(total/.008),step=total/slices;
 for(let i=0;i<slices;i++){
  const p=skateLoopSample(ride);
  const acceleration=-3*p.dy/p.ds-.08*Math.sign(ride.speed);
  const speed=ride.speed+acceleration*step;
  const angle=ride.angle+(ride.speed+speed)*.5*step/p.ds;
  const lateral=ride.entryLateralSpeed??0,decay=Math.exp(-step*8);
  const maxLane=SKATE_LOOP.width*.5-.22;
  const laneZ=clamp(ride.laneZ+lateral*(1-decay)/8,SKATE_LOOP.center.z-maxLane,SKATE_LOOP.center.z+maxLane);
  const edge=Math.abs(laneZ-SKATE_LOOP.center.z)>=maxLane-1e-8;
  ride={...ride,speed,angle:clamp(angle,0,LOOP_TAU),laneZ,entryLateralSpeed:edge?0:lateral*decay};
  if(angle<=0&&speed<0){completed=direction===-1;returned=!completed;break;}
  if(angle>=LOOP_TAU&&speed>0){completed=direction===1;returned=!completed;break;}
 }
 return {ride,completed,returned};
}

/** Look through the open side instead of the opaque descending timber skin. */
export function skateLoopCamera(ride:SkateLoopRide){
 const x=SKATE_LOOP.center.x-SKATE_LOOP.exitOffset*.5;
 return {position:{x:x+1,y:ride.baseY+SKATE_LOOP.radiusY+1.2,
  z:SKATE_LOOP.center.z-14},
  look:{x,y:ride.baseY+SKATE_LOOP.radiusY-.2,
   z:SKATE_LOOP.center.z+SKATE_LOOP.laneOffset*.5}};
}

/** Preserve the swept lane and sub-frame progress at either mouth. */
export function enterSkateLoop(previous:Point,current:Point,heading:Point,speed:number,
 wheelY:number,groundY:number,exitGroundY:number):SkateLoopRide|null{
 const direction=skateLoopEntryDirection(previous,current,heading,speed);
 if(!direction||!Number.isFinite(wheelY))return null;
 const initial=beginSkateLoop(speed,groundY,SKATE_LOOP.center.z,exitGroundY,direction);
 const mouth=skateLoopSample(initial);
 if(Math.abs(wheelY-mouth.y)>.25)return null;
 const dx=current.x-mouth.point.x,dz=current.z-mouth.point.z;
 const lane=(dx*mouth.right[0]+dz*mouth.right[2])*direction;
 const progress=Math.max(0,dx*mouth.forward[0]+dz*mouth.forward[2]);
 if(Math.abs(lane)>SKATE_LOOP.width*.5-.22)return null;
 const len=Math.hypot(heading.x,heading.z);
 const along=speed*(heading.x*mouth.forward[0]+heading.z*mouth.forward[2])/len;
 const lateral=speed*(heading.x*mouth.right[0]+heading.z*mouth.right[2])/len*direction;
 return {...initial,speed:direction*along,entryLateralSpeed:lateral,laneZ:SKATE_LOOP.center.z+lane,
  angle:clamp(initial.angle+direction*progress/mouth.ds,0,LOOP_TAU)};
}
