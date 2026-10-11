/** Self-contained arcade watercraft course. Coordinates share the World island
 * map; a larger around-island route requires extending navigable water bounds.
 * Inspired by Sunwake Rush checkpoint pacing, not copied source code. */
import type {Point} from "./model";
export type JetSkiType="touring"|"sport"|"race";
export type JetSkiPhase="docked"|"racing"|"finished";
export type JetSkiState={phase:JetSkiPhase;craft:JetSkiType;position:Point;
 heading:number;speed:number;elapsed:number;checkpoint:number;lap:number;
 penalties:number;};
export const JET_SKI_DOCK={x:62.5,z:12} as const;
export const JET_SKI_START={x:68,z:12} as const;
export const JET_SKI_PROFILES={
 touring:{acceleration:14,maxSpeed:17,turnRate:2.15,drag:.92},
 sport:{acceleration:19,maxSpeed:23,turnRate:1.85,drag:.84},
 race:{acceleration:24,maxSpeed:28,turnRate:1.55,drag:.8},
} as const;
export const JET_SKI_LAPS=2;
/** All these coastal gates must be verified as water by the map audit. */
export const JET_SKI_GATES:readonly Point[]=[
 {x:73,z:28},{x:85,z:37},{x:88,z:12},{x:84,z:-15},
 {x:73,z:-34},{x:69,z:-17},{x:78,z:0},{x:68,z:12},
];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function startJetSkiRace(craft:JetSkiType="sport"):JetSkiState{
 return {phase:"racing",craft,position:{...JET_SKI_START},
 heading:0,speed:0,elapsed:0,checkpoint:0,lap:0,penalties:0};
}
export function jetSkiGateDistance(s:JetSkiState){
 const gate=JET_SKI_GATES[s.checkpoint];
 return Math.hypot(s.position.x-gate.x,s.position.z-gate.z);
}
/** Fixed-duration substeps give deterministic arcade handling with speed-based
 * steer assist. Land rejects the move instead of teleporting the rider. */
export function stepJetSkiRace(state:JetSkiState,dt:number,
 input:{throttle:number;steer:number;brake?:boolean},
 isWater:(p:Point)=>boolean):JetSkiState{
 if(state.phase!=="racing"||!Number.isFinite(dt)||dt<=0)return state;
 let s={...state,position:{...state.position}};
 let remaining=Math.min(dt,.12);
 const profile=JET_SKI_PROFILES[s.craft];
 while(remaining>1e-8){
  const h=Math.min(remaining,1/120);remaining-=h;
  const throttle=clamp(input.throttle,-1,1),steer=clamp(input.steer,-1,1);
  const brake=input.brake?2.8:1;
  const acceleration=throttle>=0?profile.acceleration*throttle:
   profile.acceleration*.7*throttle;
  s.speed=clamp(s.speed+(acceleration-profile.drag*s.speed*brake)*h,-5,profile.maxSpeed);
  const steerAssist=.42+.58*Math.min(1,Math.abs(s.speed)/10);
  s.heading+=steer*profile.turnRate*steerAssist*h*(s.speed<0?-1:1);
  const next={x:s.position.x+Math.sin(s.heading)*s.speed*h,
   z:s.position.z+Math.cos(s.heading)*s.speed*h};
  if(isWater(next))s.position=next;
  else{s.speed=Math.min(0,s.speed)*.25;s.penalties++;}
  s.elapsed+=h;
  const gate=JET_SKI_GATES[s.checkpoint];
  if(Math.hypot(s.position.x-gate.x,s.position.z-gate.z)<5.5){
   s.checkpoint++;
   if(s.checkpoint===JET_SKI_GATES.length){
    s.checkpoint=0;s.lap++;
    if(s.lap>=JET_SKI_LAPS){s.phase="finished";s.speed=0;break;}
   }
  }
 }
 return s;
}
