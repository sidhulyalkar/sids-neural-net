import type {Point} from "./model";

export type TreatVector={x:number;y:number;z:number};
export type TreatFlight={
  origin:TreatVector;
  velocity:TreatVector;
  landing:Point;
  duration:number;
  gravity:number;
  arcLift:number;
  power:number;
  angle:number;
};
export type TreatMissReason="terrain"|"interrupted"|"unsafe"|"timeout";
export type TreatCatchResult={caught:boolean;distance:number;score:number;label:string};
export type TreatFlightEvent={kind:"flying"|"caught"|"terrain"|"landed";time:number};
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,Number.isFinite(n)?n:lo));

/**
 * Consistent, intentionally dramatic physics: y(t) is still a parabola.
 * Arc lift is defined above the straight line from release to touchdown,
 * so it can be tuned without letting throws float or alter horizontal reach.
 * The extra 3D height is scenic, not a fake easing offset in the renderer.
 */
export function makeTreatFlight(
  player:Point,dog:Point,groundY:number,power:number,angleDegrees:number,
):TreatFlight{
  const strength=clamp(power,20,100),angle=clamp(angleDegrees,-35,35);
  const deltaX=dog.x-player.x,deltaZ=dog.z-player.z;
  const length=Math.hypot(deltaX,deltaZ);
  const dx=length>.01?deltaX/length:0,dz=length>.01?deltaZ/length:1;
  const theta=angle*Math.PI/180;
  const fx=dx*Math.cos(theta)-dz*Math.sin(theta);
  const fz=dx*Math.sin(theta)+dz*Math.cos(theta);
  const range=4+strength*.35;
  const duration=1.65+strength*.0145;
  const arcLift=4+strength*.055;
  const gravity=8*arcLift/(duration*duration);
  const origin={x:player.x,y:groundY+1.55,z:player.z};
  const landingY=groundY+.35;
  const vy=(landingY-origin.y)/duration+.5*gravity*duration;
  return {
    origin,velocity:{x:fx*range/duration,y:vy,z:fz*range/duration},
    landing:{x:player.x+fx*range,z:player.z+fz*range},
    duration,gravity,arcLift,power:strength,angle,
  };
}
export function sampleTreatFlight(flight:TreatFlight,t:number):TreatVector{
  const time=clamp(t,0,flight.duration);
  return {
    x:flight.origin.x+flight.velocity.x*time,
    y:flight.origin.y+flight.velocity.y*time-.5*flight.gravity*time*time,
    z:flight.origin.z+flight.velocity.z*time,
  };
}
/** Solve the *descending* crossing of the mouth height, not the arbitrary
 * last 0.1 seconds of flight. Higher arcs remain catchable at the right time.
 */
export function descendingTreatTime(flight:TreatFlight,mouthY:number):number{
  const vy=flight.velocity.y,g=flight.gravity;
  const discriminant=vy*vy+2*g*(flight.origin.y-mouthY);
  if(!Number.isFinite(discriminant)||discriminant<0)return flight.duration*.7;
  const t=(vy+Math.sqrt(discriminant))/g;
  return clamp(t,.2,flight.duration-.015);
}
/** Shasta's root must be one muzzle length behind the moving treat.
 * If already beyond the goal, approach from the opposite direction.
 */
export function planTreatCatchGoal(flight:TreatFlight,dog:Point,mouthY?:number):Point{
  const desired=Number.isFinite(mouthY)?mouthY!:flight.origin.y-.25;
  const time=descendingTreatTime(flight,desired);
  const catchPoint=sampleTreatFlight(flight,time);
  const length=Math.hypot(flight.velocity.x,flight.velocity.z)||1;
  const dx=flight.velocity.x/length,dz=flight.velocity.z/length;
  const ahead=(dog.x-catchPoint.x)*dx+(dog.z-catchPoint.z)*dz>0;
  const side=ahead?1:-1;
  return {x:catchPoint.x+dx*side*1.16,z:catchPoint.z+dz*side*1.16};
}
export function treatWithinMouth(flight:TreatFlight,t:number,mouth:Point,mouthY:number):boolean{
  if(t<.15||t>flight.duration)return false;
  const treat=sampleTreatFlight(flight,t);
  return Math.hypot(treat.x-mouth.x,treat.z-mouth.z)<.78 &&
    Math.abs(treat.y-mouthY)<.8;
}

/** Swept catch test across the last rendered interval.
 * Relative mouth motion is interpolated; no low-FPS projectile tunneling.
 * Terrain wins if the treat struck the ground before reaching the muzzle.
 * Bounded 1..64 samples, and called only while a treat is airborne.
 */
export function stepTreatFlight(
  flight:TreatFlight,fromTime:number,toTime:number,
  previousMouth:TreatVector,currentMouth:TreatVector,
  terrainAt:(x:number,z:number)=>number,
):TreatFlightEvent{
  const start=clamp(fromTime,0,flight.duration);
  const end=clamp(toTime,start,flight.duration);
  const segments=Math.min(64,Math.max(1,Math.ceil((end-start)/.024)));
  for(let i=1;i<=segments;i++){
    const fraction=i/segments,t=start+(end-start)*fraction;
    const p=sampleTreatFlight(flight,t);
    const ground=terrainAt(p.x,p.z);
    if(Number.isFinite(ground)&&p.y<=ground+.09)return {kind:"terrain",time:t};
    if(t<.15)continue;
    const mx=previousMouth.x+(currentMouth.x-previousMouth.x)*fraction;
    const my=previousMouth.y+(currentMouth.y-previousMouth.y)*fraction;
    const mz=previousMouth.z+(currentMouth.z-previousMouth.z)*fraction;
    if(Math.hypot(p.x-mx,p.z-mz)<.78&&Math.abs(p.y-my)<.8)
      return {kind:"caught",time:t};
  }
  return end>=flight.duration?{kind:"landed",time:flight.duration}:
    {kind:"flying",time:end};
}
export function scoreTreatFlight(
  flight:TreatFlight,t:number,caught:boolean,reason?:TreatMissReason,
):TreatCatchResult{
  const pos=sampleTreatFlight(flight,t);
  const distance=Math.hypot(pos.x-flight.origin.x,pos.z-flight.origin.z);
  if(!caught){
    const label=reason==="terrain"?"Blocked by terrain":
      reason==="interrupted"?"Throw interrupted":
      reason==="unsafe"?"Unsafe landing":"Missed treat";
    return {caught:false,distance,score:0,label};
  }
  const long=distance>=18,angled=Math.abs(flight.angle)>=12;
  const label=long&&angled?"Long-range trickshot":long?"Long-distance catch":
    angled?"Off-axis trickshot":"Clean catch";
  return {caught:true,distance,score:Math.round(distance*12+Math.abs(flight.angle)*3),label};
}
