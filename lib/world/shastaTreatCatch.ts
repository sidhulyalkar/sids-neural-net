import type {Point} from "./model";
export type TreatFlight={
  origin:{x:number;y:number;z:number};
  velocity:{x:number;y:number;z:number};
  landing:Point;duration:number;gravity:number;power:number;angle:number;
};
export type TreatCatchResult={
  caught:boolean;distance:number;score:number;label:string;
};
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,Number.isFinite(n)?n:lo));

/** A deterministic ballistic toss aimed from the player toward Shasta.
 * The angle control deliberately lets players try off-axis trickshots.
 * Coordinates use existing world units (displayed as approximate meters).
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
  const range=4+strength*.26;
  const duration=1.3+strength*.013;
  const gravity=9.81;
  const origin={x:player.x,y:groundY+1.55,z:player.z};
  // The projectile lands approximately 0.35 units above the launch floor.
  const vy=(.35-origin.y+groundY+.5*gravity*duration*duration)/duration;
  return {
    origin,velocity:{x:fx*range/duration,y:vy,z:fz*range/duration},
    landing:{x:player.x+fx*range,z:player.z+fz*range},
    duration,gravity,power:strength,angle,
  };
}
export function sampleTreatFlight(flight:TreatFlight,t:number){
  const time=clamp(t,0,flight.duration);
  return {
    x:flight.origin.x+flight.velocity.x*time,
    y:flight.origin.y+flight.velocity.y*time-.5*flight.gravity*time*time,
    z:flight.origin.z+flight.velocity.z*time,
  };
}
/** Station Shasta's root so his actual muzzle meets the descending treat.
 * If he starts beyond the intercept, he runs back facing the incoming treat.
 * Computed once per throw: movement still uses real obstacle-safe steering.
 */
export function planTreatCatchGoal(flight:TreatFlight,dog:Point):Point{
  const time=Math.max(.2,flight.duration-.11);
  const catchPoint=sampleTreatFlight(flight,time);
  const length=Math.hypot(flight.velocity.x,flight.velocity.z)||1;
  const dx=flight.velocity.x/length,dz=flight.velocity.z/length;
  const ahead=(dog.x-catchPoint.x)*dx+(dog.z-catchPoint.z)*dz>0;
  const side=ahead?1:-1;
  return {x:catchPoint.x+dx*side*1.16,z:catchPoint.z+dz*side*1.16};
}
export function treatWithinMouth(
  flight:TreatFlight,t:number,dog:Point,mouthY:number,
){
  if(t<.15||t>flight.duration)return false;
  const treat=sampleTreatFlight(flight,t);
  return Math.hypot(treat.x-dog.x,treat.z-dog.z)<.78 &&
    Math.abs(treat.y-mouthY)<.8;
}
export function scoreTreatFlight(flight:TreatFlight,t:number,caught:boolean):TreatCatchResult{
  const pos=sampleTreatFlight(flight,t);
  const distance=Math.hypot(pos.x-flight.origin.x,pos.z-flight.origin.z);
  if(!caught)return {caught:false,distance,score:0,label:"Missed treat"};
  const long=distance>=18,angled=Math.abs(flight.angle)>=12;
  const label=long&&angled?"Long-range trickshot":long?"Long-distance catch":
    angled?"Off-axis trickshot":"Clean catch";
  return {caught:true,distance,score:Math.round(distance*12+Math.abs(flight.angle)*3),label};
}
