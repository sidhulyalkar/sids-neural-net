import type {Point} from "./model";

/** Deterministic small-animal motion. Heading is limited, threats persist for
 * a short interval, and wet/out-of-range steps are rejected without a
 * per-frame 180-degree target flip. */
export type CritterLocomotion={
 point:Point;home:Point;heading:number;phase:number;
 roam:number;speed:number;panicUntil:number;fleeFrom:Point|null;
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function angularDifference(a:number,b:number):number{
 return Math.atan2(Math.sin(b-a),Math.cos(b-a));
}
export function stepCritterLocomotion(
 state:CritterLocomotion,dt:number,now:number,threat:Point|null,
 invalid:(p:Point)=>boolean,
):{motion:CritterLocomotion;step:number;turned:number}{
 const delta=clamp(Number.isFinite(dt)?dt:0,0,.08);
 if(delta===0)return {motion:state,step:0,turned:0};
 const panic=threat!==null?now+1.1:state.panicUntil;
 const fleeFrom=threat??state.fleeFrom;
 const fleeing=now<panic&&fleeFrom!==null;
 const phase=state.phase+delta*state.speed*.17;
 const target=fleeing?{
  x:state.point.x+(state.point.x-fleeFrom.x)*2,
  z:state.point.z+(state.point.z-fleeFrom.z)*2,
 }:{
  x:state.home.x+Math.cos(phase)*state.roam*.66,
  z:state.home.z+Math.sin(phase*.83)*state.roam*.66,
 };
 if(Math.hypot(target.x-state.home.x,target.z-state.home.z)>state.roam*1.65){
  target.x=state.home.x+(target.x-state.home.x)*.5;
  target.z=state.home.z+(target.z-state.home.z)*.5;
 }
 const dx=target.x-state.point.x,dz=target.z-state.point.z;
 const direction=Math.hypot(dx,dz)>.12?
  Math.atan2(dx,dz):state.heading;
 const maxTurn=(fleeing?2.6:1.8)*delta;
 const turned=clamp(angularDifference(state.heading,direction),-maxTurn,maxTurn);
 const heading=state.heading+turned;
 const pace=state.speed*(fleeing?1.65:.7);
 const step=Math.min(pace*delta,Math.hypot(dx,dz)*.35);
 const candidate={x:state.point.x+Math.sin(heading)*step,
  z:state.point.z+Math.cos(heading)*step};
 if(invalid(candidate)||Math.hypot(
    candidate.x-state.home.x,candidate.z-state.home.z)>state.roam*1.75){
  const homeHeading=Math.atan2(state.home.x-state.point.x,
   state.home.z-state.point.z);
  const correction=clamp(angularDifference(heading,homeHeading),-maxTurn,maxTurn);
  return {motion:{...state,phase,panicUntil:panic,fleeFrom,
    heading:heading+correction},step:0,turned};
 }
 return {motion:{...state,point:candidate,heading,phase,
  panicUntil:panic,fleeFrom},step,turned};
}
