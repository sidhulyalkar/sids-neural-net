/** Original arcade watercraft simulation and circumnavigation course.
 * Gameplay inspiration: Sunwake Rush's checkpoints and readable handling.
 * The island mesh occupies WORLD_BOUNDS; the open-ocean north/south legs are
 * beyond it, while the east/west legs use the existing coastal water zones. */
import {coastlineX,eastCoastlineX,WORLD_BOUNDS,type Point} from "./model";
export type JetSkiType="touring"|"sport"|"race";
export type JetSkiPhase="docked"|"racing"|"finished";
export type JetSkiInput={throttle:number;steer:number;brake?:boolean};
export type JetSkiState={
 phase:JetSkiPhase;craft:JetSkiType;position:Point;heading:number;
 speed:number;elapsed:number;checkpoint:number;lap:number;
 penalties:number;shoreContact:boolean;
};
export const JET_SKI_DOCK={x:62.5,z:12} as const;
export const JET_SKI_START={x:68,z:12} as const;
export const JET_SKI_PROFILES={
 touring:{acceleration:14,maxSpeed:17,turnRate:2.15,drag:.92},
 sport:{acceleration:19,maxSpeed:23,turnRate:1.85,drag:.84},
 race:{acceleration:24,maxSpeed:28,turnRate:1.55,drag:.8},
} as const;
export const JET_SKI_LAPS=2;
/** One ordered clockwise lap, from the eastern dock around BOTH island ends.
 * Keep bends wide so touring craft can complete the route without braking
 * into dry ground. North/south gates lie beyond the finite terrain mesh. */
export const JET_SKI_GATES:readonly Point[]=[
 {x:75,z:36},{x:77,z:59},{x:75,z:81},
 {x:41,z:87},{x:0,z:88},{x:-39,z:85},
 {x:-58,z:75},{x:-60,z:41},{x:-59,z:4},
 {x:-61,z:-36},{x:-61,z:-80},{x:-59,z:-119},
 {x:-25,z:-127},{x:17,z:-127},{x:56,z:-124},
 {x:76,z:-97},{x:77,z:-59},{x:75,z:-20},{x:69,z:13},
];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
/** The ocean plane continues beyond the north/south terrain edge. Use a
 * conservative safety margin so racers cannot drive over invisible land.
 * Keep swimming/ecology water semantics unchanged. */
export function jetSkiNavigableWater(point:Point):boolean{
 const {x,z}=point;
 if(!Number.isFinite(x)||!Number.isFinite(z)||
    x< -104||x>109||z< -152||z>108)return false;
 if(z>WORLD_BOUNDS.maxZ+20||z<WORLD_BOUNDS.minZ-20)return true;
 return x>eastCoastlineX(z)+1.5||x<coastlineX(z)-1.5;
}
export function startJetSkiRace(craft:JetSkiType="sport"):JetSkiState{
 return {phase:"racing",craft,position:{...JET_SKI_START},
 heading:0,speed:0,elapsed:0,checkpoint:0,lap:0,
 penalties:0,shoreContact:false};
}
export function jetSkiGateDistance(s:JetSkiState):number{
 const gate=JET_SKI_GATES[s.checkpoint];
 return Math.hypot(s.position.x-gate.x,s.position.z-gate.z);
}
/** Heading hint relative to the bow. Clockwise positive means steer right. */
export function jetSkiBearingToGate(s:JetSkiState):number{
 const gate=JET_SKI_GATES[s.checkpoint];
 const absolute=Math.atan2(gate.x-s.position.x,gate.z-s.position.z);
 return Math.atan2(Math.sin(absolute-s.heading),Math.cos(absolute-s.heading));
}
function segmentWithinGate(a:Point,b:Point,gate:Point,radius:number):boolean{
 const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
 const t=den>1e-9?clamp(((gate.x-a.x)*dx+(gate.z-a.z)*dz)/den,0,1):0;
 return Math.hypot(a.x+dx*t-gate.x,a.z+dz*t-gate.z)<=radius;
}
/** Deterministic fixed substeps; both full and partial frame updates use the
 * same handling. Contact penalties apply once per shoreline impact, never 120
 * times a second. Gates are swept so fast skis cannot tunnel through buoys. */
export function stepJetSkiRace(state:JetSkiState,dt:number,
 input:JetSkiInput,water:(p:Point)=>boolean=jetSkiNavigableWater):JetSkiState{
 if(state.phase!=="racing"||!Number.isFinite(dt)||dt<=0)return state;
 let s={...state,position:{...state.position}};
 let remaining=Math.min(dt,.12);
 const profile=JET_SKI_PROFILES[s.craft];
 while(remaining>1e-8){
  const h=Math.min(remaining,1/120);remaining-=h;
  const throttle=clamp(Number.isFinite(input.throttle)?input.throttle:0,-1,1);
  const steer=clamp(Number.isFinite(input.steer)?input.steer:0,-1,1);
  const brake=input.brake?2.8:1;
  const acceleration=throttle>=0?profile.acceleration*throttle:
   profile.acceleration*.7*throttle;
  s.speed=clamp(s.speed+(acceleration-profile.drag*s.speed*brake)*h,-5,profile.maxSpeed);
  const steerAssist=.42+.58*Math.min(1,Math.abs(s.speed)/10);
  s.heading+=steer*profile.turnRate*steerAssist*h*(s.speed<0?-1:1);
  const next={x:s.position.x+Math.sin(s.heading)*s.speed*h,
   z:s.position.z+Math.cos(s.heading)*s.speed*h};
  const before=s.position;
  if(water(next)){s.position=next;s.shoreContact=false;}
  else{
   if(!s.shoreContact)s.penalties++;
   s.shoreContact=true;s.speed=0;
  }
  s.elapsed+=h;
  const gate=JET_SKI_GATES[s.checkpoint];
  if(segmentWithinGate(before,s.position,gate,5.8)){
   s.checkpoint++;
   if(s.checkpoint===JET_SKI_GATES.length){
    s.checkpoint=0;s.lap++;
    if(s.lap>=JET_SKI_LAPS){s.phase="finished";s.speed=0;break;}
   }
  }
 }
 return s;
}

/** Shared physics, independent steering policy. Opponents anticipate tight
 * bends and coast before sharp turns; they cannot bypass shoreline collision.
 * No rubber-banding or scripted teleporting. */
export function jetSkiOpponentInput(state:JetSkiState,pace=.85):JetSkiInput{
 const headingError=jetSkiBearingToGate(state);
 const curve=Math.abs(headingError);
 const top=JET_SKI_PROFILES[state.craft].maxSpeed*clamp(pace,.55,1);
 const target=curve>.95?top*.42:curve>.42?top*.68:top;
 return {
  throttle:state.speed<target?1:0,
  steer:clamp(headingError*1.7,-1,1),
  brake:state.speed>target+2,
 };
}
/** Interpolated checkpoint progress is sufficient for a readable leaderboard.
 * Gate count remains authoritative for actual race completion. */
export function jetSkiRaceProgress(state:JetSkiState):number{
 if(state.phase==="finished")return JET_SKI_GATES.length*JET_SKI_LAPS;
 const previous=state.checkpoint===0?
  (state.lap===0?JET_SKI_START:JET_SKI_GATES.at(-1)!):
  JET_SKI_GATES[state.checkpoint-1];
 const next=JET_SKI_GATES[state.checkpoint];
 const dx=next.x-previous.x,dz=next.z-previous.z;
 const t=clamp(((state.position.x-previous.x)*dx+
  (state.position.z-previous.z)*dz)/Math.max(.001,dx*dx+dz*dz),0,.99);
 return state.lap*JET_SKI_GATES.length+state.checkpoint+t;
}
