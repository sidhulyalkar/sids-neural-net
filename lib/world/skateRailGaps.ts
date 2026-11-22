import type {Point} from "./model";
import {SKATE_PARK_RAILS,SKATE_RAIL_GAPS,railLiftAt,type SkateRail} from "./skatepark";

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const length=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.z-a.z);
const direction=(a:Point,b:Point):Point=>{
 const d=Math.max(1e-6,length(a,b));
 return {x:(b.x-a.x)/d,z:(b.z-a.z)/d};
};

/** A physical, authored open-air gap between two DIFFERENT grind lines.
 * The gap is not a new invisible rail and never alters ground collisions. */
export type SkateRailGapRide={
 id:string;from:string;to:string;time:number;duration:number;speed:number;
 start:Point;end:Point;startY:number;endY:number;arch:number;
 startHeading:Point;endHeading:Point;
 toT:number;
};

export function beginSkateRailGap(
 rail:SkateRail,travelDirection:number,speed:number,
 support:(p:Point)=>number,
):SkateRailGapRide|null{
 const spec=SKATE_RAIL_GAPS.find(g=>g.from===rail.id);
 if(!spec||travelDirection<0||!Number.isFinite(speed)||speed<spec.minSpeed)
  return null;
 const destination=SKATE_PARK_RAILS.find(r=>r.id===spec.to);
 if(!destination||destination.id===rail.id)return null;
 const toT=.12,start={...rail.b};
 const end={x:destination.a.x+(destination.b.x-destination.a.x)*toT,
  z:destination.a.z+(destination.b.z-destination.a.z)*toT};
 const gap=length(start,end);
 const startHeading=direction(rail.a,rail.b);
 const endHeading=direction(destination.a,destination.b);
 const into=direction(start,end);
 // No teleport to arbitrary rails or 180° backward magnetic catches.
 if(!Number.isFinite(gap)||gap<1.0||gap>6.3||
   startHeading.x*into.x+startHeading.z*into.z<.48||
   endHeading.x*into.x+endHeading.z*into.z<.18)return null;
 const startY=support(start)+railLiftAt(rail,1)+.16;
 const groundY=support(destination.a)*(1-toT)+support(destination.b)*toT;
 const endY=groundY+railLiftAt(destination,toT)+.16;
 if(![startY,endY].every(Number.isFinite))return null;
 return {id:spec.id,from:rail.id,to:destination.id,time:0,
  duration:clamp(gap/Math.max(4.8,speed),.43,.94),speed,
  start,end,startY,endY,arch:clamp(gap*.34,.92,1.68),
  startHeading,endHeading,toT};
}

export function skateRailGapSample(ride:SkateRailGapRide){
 const t=clamp(ride.time/ride.duration,0,1);
 const gap=length(ride.start,ride.end);
 // Cubic Hermite gives an aligned takeoff and a tangent at touchdown.
 const d0=gap*.74,d1=gap*.72;
 const a=2*t*t*t-3*t*t+1,b=t*t*t-2*t*t+t;
 const c=-2*t*t*t+3*t*t,d=t*t*t-t*t;
 const x=a*ride.start.x+b*ride.startHeading.x*d0+
  c*ride.end.x+d*ride.endHeading.x*d1;
 const z=a*ride.start.z+b*ride.startHeading.z*d0+
  c*ride.end.z+d*ride.endHeading.z*d1;
 const dx=(6*t*t-6*t)*ride.start.x+(3*t*t-4*t+1)*ride.startHeading.x*d0+
  (-6*t*t+6*t)*ride.end.x+(3*t*t-2*t)*ride.endHeading.x*d1;
 const dz=(6*t*t-6*t)*ride.start.z+(3*t*t-4*t+1)*ride.startHeading.z*d0+
  (-6*t*t+6*t)*ride.end.z+(3*t*t-2*t)*ride.endHeading.z*d1;
 const magnitude=Math.hypot(dx,dz);
 const heading=magnitude>1e-6?{x:dx/magnitude,z:dz/magnitude}:ride.endHeading;
 const y=ride.startY+(ride.endY-ride.startY)*t+
  ride.arch*Math.sin(Math.PI*t);
 return {point:{x,z},y,heading,progress:t,
  airborne:t>0&&t<1,done:t>=1-1e-9};
}

/** Time is bounded independently from slow render frames; path sampling is
 * deterministic at 10, 20, 40 or 60 FPS. Completion happens once, at the
 * authored receiving rail, never via a free-form nearest-grind search. */
export function advanceSkateRailGap(ride:SkateRailGapRide,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return {ride,completed:false};
 const time=clamp(ride.time+clamp(dt,0,.5),0,ride.duration);
 const next={...ride,time};
 return {ride:next,completed:time>=ride.duration-1e-9};
}
