/** Original arcade watercraft simulation and circumnavigation course.
 * Gameplay inspiration: Sunwake Rush's checkpoints and readable handling.
 * The island mesh occupies WORLD_BOUNDS; the open-ocean north/south legs are
 * beyond it, while the east/west legs use the existing coastal water zones. */
import {coastlineX,eastCoastlineX,WORLD_BOUNDS,isWater,type Point} from "./model";
import {northShoreZ} from "./skimboarding";
import {jetSkiRockAt} from "./jetSkiCourse";
import {jetSkiWaterSample,jetSkiJumpAt,jetSkiCrestImpulse} from "./jetSkiWater";
export type JetSkiType="touring"|"sport"|"race";
export type JetSkiPhase="docked"|"racing"|"finished";
export type JetSkiInput={throttle:number;steer:number;brake?:boolean;turbo?:boolean};
export type JetSkiState={
 phase:JetSkiPhase;craft:JetSkiType;position:Point;heading:number;
 speed:number;elapsed:number;checkpoint:number;lap:number;
 penalties:number;shoreContact:boolean;rockContact:boolean;rockHits:number;
 turbo:number;boosting:boolean;boostLocked:boolean;jumpHeight:number;jumpVelocity:number;
 jumpCooldown:number;landingSplash:number;waterHeight:number;
 roll:number;pitch:number;roughness:number;current:Point;
};
// Keep craft beyond the pier end: the old start position intersected its deck.
export const JET_SKI_DOCK={x:70.8,z:14} as const;
export const JET_SKI_START={x:72,z:14} as const;
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
 {x:41,z:87},{x:0,z:117},{x:-39,z:85},
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
    x< -104||x>109||z< -152||z>Math.max(108,WORLD_BOUNDS.maxZ+36))return false;
 if(z>Math.max(76,northShoreZ(x)+4.5)&&isWater(point))return true;
 if(z<WORLD_BOUNDS.minZ-20)return true;
 return x>eastCoastlineX(z)+1.5||x<coastlineX(z)-1.5;
}
export function startJetSkiRace(craft:JetSkiType="sport"):JetSkiState{
 return {phase:"racing",craft,position:{...JET_SKI_START},
 heading:0,speed:0,elapsed:0,checkpoint:0,lap:0,
 penalties:0,shoreContact:false,rockContact:false,rockHits:0,
 turbo:100,boosting:false,boostLocked:false,jumpHeight:0,jumpVelocity:0,
 jumpCooldown:0,landingSplash:0,waterHeight:0,
 roll:0,pitch:0,roughness:0,current:{x:0,z:0}};
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
 input:JetSkiInput,water:(p:Point)=>boolean=jetSkiNavigableWater,
 checkpoints=true):JetSkiState{
 if(state.phase!=="racing"||!Number.isFinite(dt)||dt<=0)return state;
 let s={...state,position:{...state.position},current:{...state.current}};
 let remaining=Math.min(dt,.12);
 const profile=JET_SKI_PROFILES[s.craft];
 while(remaining>1e-8){
  const h=Math.min(remaining,1/120);remaining-=h;
  const throttle=clamp(Number.isFinite(input.throttle)?input.throttle:0,-1,1);
  const steer=clamp(Number.isFinite(input.steer)?input.steer:0,-1,1);
  const waterSample=jetSkiWaterSample(s.position,s.elapsed);
  // Once depleted, boost remains locked until the rider releases it and
  // recovers enough charge. Avoids frame-by-frame microboost stuttering.
  if(!input.turbo&&s.turbo>=20)s.boostLocked=false;
  const boost=!!input.turbo&&throttle>0&&!s.boostLocked&&s.turbo>1;
  s.boosting=boost;
  s.turbo=clamp(s.turbo+(boost?-33:14)*h,0,100);
  if(boost&&s.turbo<=1)s.boostLocked=true;
  s.jumpCooldown=Math.max(0,s.jumpCooldown-h);
  s.landingSplash=Math.max(0,s.landingSplash-h);
  const brake=input.brake?2.8:1;
  const acceleration=throttle>=0?profile.acceleration*throttle*(boost?1.7:1):
   profile.acceleration*.7*throttle;
  const resistance=profile.drag*(1+waterSample.roughness*.09);
  const maximum=profile.maxSpeed*(boost?1.42:1);
  // Releasing turbo decelerates instead of snapping instantly to cruise cap.
  const smoothLimit=boost?maximum:Math.max(maximum,s.speed-9*h);
  s.speed=clamp(s.speed+(acceleration-resistance*s.speed*brake)*h,
   -8,smoothLimit);
  const steerAssist=.42+.58*Math.min(1,Math.abs(s.speed)/10);
  s.heading+=steer*profile.turnRate*steerAssist*(boost?.84:1)*
   (s.jumpHeight>0?.35:1)*h*(s.speed<0?-1:1);
  const before=s.position;
  // A bounded current bends the racing line; it never teleports the craft.
  const currentFactor=s.jumpHeight>0?.12:.68;
  const next={
   x:s.position.x+(Math.sin(s.heading)*s.speed+
    waterSample.current.x*currentFactor)*h,
   z:s.position.z+(Math.cos(s.heading)*s.speed+
    waterSample.current.z*currentFactor)*h,
  };
  const rock=jetSkiRockAt(next);
  if(water(next)&&!rock){
   s.position=next;s.shoreContact=false;
   // Release the rock-contact latch only after leaving a wider clearance.
   // Without hysteresis, tiny forward substeps at the rim count as new hits.
   s.rockContact=jetSkiRockAt(next,1.35)!==null;
  }else{
   if(rock){
    if(!s.rockContact){s.rockHits++;s.penalties++;}
    s.rockContact=true;
   }else if(!s.shoreContact)s.penalties++;
   s.shoreContact=!rock;s.speed=Math.min(0,s.speed)*.1;
  }
  s.elapsed+=h;
  const surface=jetSkiWaterSample(s.position,s.elapsed);
  s.waterHeight=surface.height;
  s.roughness=surface.roughness;s.current=surface.current;
  if(s.jumpHeight<=0&&s.jumpCooldown<=0){
   const jump=jetSkiJumpAt(s.position,s.heading,s.speed);
   const impulse=jump?jump.impulse+(boost?1.3:0):
    jetSkiCrestImpulse(surface,s.heading,s.speed,boost);
   if(impulse>0){
    s.jumpHeight=.02;
    s.jumpVelocity=impulse;
    s.jumpCooldown=jump?3.2:2.6;
   }
  }
  if(s.jumpHeight>0){
   s.jumpVelocity-=10.8*h;
   s.jumpHeight+=s.jumpVelocity*h;
   if(s.jumpHeight<=0){
    s.jumpHeight=0;s.jumpVelocity=0;s.landingSplash=.42;
   }
  }
  const fx=Math.sin(s.heading),fz=Math.cos(s.heading);
  // Wave slope gives small visually coherent pitch/roll without sudden flips.
  const wantPitch=clamp(-(surface.slopeX*fx+surface.slopeZ*fz)*2,-.24,.24);
  const wantRoll=clamp(-steer*Math.min(1,Math.abs(s.speed)/12)*.23+
   (surface.slopeX*fz-surface.slopeZ*fx),-.38,.38);
  s.pitch+=(wantPitch-s.pitch)*Math.min(1,h*8);
  s.roll+=(wantRoll-s.roll)*Math.min(1,h*8);
  const gate=JET_SKI_GATES[s.checkpoint];
  if(checkpoints&&segmentWithinGate(before,s.position,gate,5.8)){
   // Clean checkpoint routing rewards precision without requiring pickups.
   s.turbo=clamp(s.turbo+8,0,100);
   s.checkpoint++;
   if(s.checkpoint===JET_SKI_GATES.length){
    s.checkpoint=0;s.lap++;
    if(s.lap>=JET_SKI_LAPS){
     s.phase="finished";s.speed=0;s.boosting=false;break;
    }
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

/** Compare checkpoint progress during the race and elapsed finish time once
 * two riders have completed the route. Finished racers retain real placement
 * even when everyone eventually has the same gate count. */
export function jetSkiRacePlace(player:JetSkiState,rivals:readonly JetSkiState[]):number{
 return 1+rivals.filter(rival=>{
  if(player.phase==="finished"){
   return rival.phase==="finished"&&rival.elapsed<player.elapsed;
  }
  return rival.phase==="finished"||
   jetSkiRaceProgress(rival)>jetSkiRaceProgress(player);
 }).length;
}
