import type {Point} from "./model";
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** A continuous mountain incline is not a cliff just because a frame moved
 * more than 0.6 units vertically. Reject sharp boulder lids and fake decks. */
export function isContinuousRideRise(from:Point,to:Point,support:(p:Point)=>number,base:(p:Point)=>number):boolean{
 const distance=Math.hypot(to.x-from.x,to.z-from.z);
 if(!Number.isFinite(distance)||distance<1e-5)return false;
 const low=support(from),high=support(to),rise=high-low;
 if(!Number.isFinite(rise)||rise<=0||rise>distance*2.6+.12)return false;
 for(const t of [0,.25,.5,.75,1]){
  const p={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};
  const y=support(p),terrain=base(p);
  if(!Number.isFinite(y)||!Number.isFinite(terrain)||
   Math.abs(y-terrain)>.48||
   Math.abs(y-(low+rise*t))>Math.max(.26,rise*.31))return false;
 }
 return true;
}
/** The wheel envelope may not snap up to a cap while its axle is still
 * riding on the lower natural terrain. Park ramps remain part of base(). */
export function rideWheelProbe(center:Point,probe:Point,support:(p:Point)=>number,base:(p:Point)=>number):number{
 const y=support(probe),natural=base(probe),centerY=support(center),centerBase=base(center);
 if(![y,natural,centerY,centerBase].every(Number.isFinite))return Number.isFinite(natural)?natural:0;
 if(y-natural>.52&&centerY-centerBase<.52&&y>centerY+.52)return natural;
 return y;
}
/** Clamp generic terrain pose spikes; loops and tubes retain exact 3D frames. */
export function rideTerrainAttitude(pitch:number,roll:number,mode:"skate"|"bike"|"ski"){
 const bank=mode==="bike"?.78:mode==="skate"?.86:.75;
 return {pitch:clamp(Number.isFinite(pitch)?pitch:0,-1.04,1.04),
  roll:clamp(Number.isFinite(roll)?roll:0,-bank,bank)};
}

/** Heading is gameplay authority: smooth only the suspension axes. An
 * in-place quaternion slerp can alias source/target and freeze yaw entirely.
 * Returning target.yaw untouched prevents steering/control divergence. */
export function followRideSurfacePose(
 previous:{pitch:number;roll:number;yaw:number},
 target:{pitch:number;roll:number;yaw:number},dt:number,
){
 const step=Number.isFinite(dt)?clamp(dt,0,.15):0;
 const blend=1-Math.exp(-step*16);
 const pitch=Number.isFinite(previous.pitch)?previous.pitch:0;
 const roll=Number.isFinite(previous.roll)?previous.roll:0;
 return {pitch:pitch+(target.pitch-pitch)*blend,
  roll:roll+(target.roll-roll)*blend,
  yaw:target.yaw};
}
