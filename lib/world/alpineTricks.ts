import type {Point} from "./model";
import {ALPINE_HALFPIPE,ALPINE_KICKERS,ALPINE_FEATURE_BOXES,alpineHalfpipeStrength} from "./alpineTerrainPark";

/** Game scoring is not an athletic skill measurement. It is driven only by
 * supported world-space crossings, observed airtime and actual touchdown. */
export type AlpineTrickFeature="halfpipe"|"kicker"|"box"|"rail";
export type AlpineGrab="none"|"left"|"right";
export type AlpineTakeoff={id:string;kind:AlpineTrickFeature;impulse:number};
export type AlpineTrickState={
  phase:"idle"|"air"|"landed"|"bailed";
  feature:string;kind:AlpineTrickFeature|null;
  startedAt:number;takeoffSpeed:number;airtime:number;peakClearance:number;
  grab:AlpineGrab;grabSeconds:number;spinDegrees:number;
  lastSpinAt:number;lastLandedAt:number;
  attempts:number;landings:number;bails:number;
  combo:number;score:number;best:number;
  lastLabel:string;lastQuality:"clean"|"rough"|"bail"|"";
};
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const length=(p:Point)=>Math.hypot(p.x,p.z);
const dot=(a:Point,b:Point)=>a.x*b.x+a.z*b.z;
const distance=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.z-a.z);
const allowedSegment=(a:Point,b:Point)=>distance(a,b)>.001&&distance(a,b)<=2.25;
export function idleAlpineTrick():AlpineTrickState{
  return {phase:"idle",feature:"",kind:null,startedAt:-Infinity,
    takeoffSpeed:0,airtime:0,peakClearance:0,grab:"none",
    grabSeconds:0,spinDegrees:0,lastSpinAt:-Infinity,lastLandedAt:-Infinity,
    attempts:0,landings:0,bails:0,combo:0,score:0,best:0,lastLabel:"",
    lastQuality:""};
}

/** A skier must cross FROM INSIDE the bank through the actual coping,
 * traveling outwards. The sheltered roll-in and both outside approaches
 * cannot be interpreted as a jump. */
export function halfpipeLipCrossing(
  before:Point,after:Point,heading:Point,speed:number,
):AlpineTakeoff|null{
  const h=ALPINE_HALFPIPE,lip=h.rimHalfWidth-.32;
  if(!Number.isFinite(speed)||speed<5.8||!allowedSegment(before,after))return null;
  if(alpineHalfpipeStrength(before)<.22)return null;
  if(Math.min(before.z,after.z)<h.startZ+3||
     Math.max(before.z,after.z)>h.endZ-3)return null;
  const side=after.x>=h.centerX?1:-1;
  const bx=(before.x-h.centerX)*side,ax=(after.x-h.centerX)*side;
  const norm=length(heading)||1;
  if(bx<0||bx>=lip||ax<lip||ax>lip+1.25||heading.x*side/norm<.48)return null;
  return {id:side===1?"alpine-halfpipe-right":"alpine-halfpipe-left",
    kind:"halfpipe",impulse:clamp(2.55+speed*.18,3.5,6.35)};
}

/** Unlike proximity-triggered ramps, alpine kickers require forward travel
 * through their lip plane, with lateral bounds and a real prior approach. */
export function alpineKickerCrossing(
  before:Point,after:Point,heading:Point,speed:number,
):AlpineTakeoff|null{
  if(!Number.isFinite(speed)||speed<5||!allowedSegment(before,after))return null;
  for(const kicker of ALPINE_KICKERS){
    const forward=kicker.heading,normal=length(forward);
    const f={x:forward.x/normal,z:forward.z/normal};
    if(dot(heading,f)/(length(heading)||1)<.76)continue;
    const dx=before.x-kicker.point.x,dz=before.z-kicker.point.z;
    const ex=after.x-kicker.point.x,ez=after.z-kicker.point.z;
    const prev=dx*f.x+dz*f.z,next=ex*f.x+ez*f.z;
    const lateral=ex*f.z-ez*f.x;
    if(prev<0&&prev>=-2.2&&next>=0&&next<=1.2&&Math.abs(lateral)<=1.275)
      return {id:kicker.id,kind:"kicker",
        impulse:clamp(kicker.lift+speed*.15,4.5,9)};
  }
  return null;
}

/** Pop at the exit of the wide box, never on its long top, edge, or
 * reverse approach. A low jib dismount is shorter than a snow kicker. */
export function alpineBoxExitCrossing(
 before:Point,after:Point,heading:Point,speed:number,
):AlpineTakeoff|null{
 if(!Number.isFinite(speed)||speed<4.2||!allowedSegment(before,after))return null;
 for(const box of ALPINE_FEATURE_BOXES){
   const vx=box.to.x-box.from.x,vz=box.to.z-box.from.z;
   const len=Math.hypot(vx,vz),f={x:vx/len,z:vz/len};
   if(dot(heading,f)/(length(heading)||1)<.78)continue;
   const project=(p:Point)=>({along:dot({x:p.x-box.from.x,z:p.z-box.from.z},f),
     cross:Math.abs((p.x-box.from.x)*f.z-(p.z-box.from.z)*f.x)});
   const a=project(before),b=project(after);
   if(a.along<len&&a.along>=len-1.3&&b.along>=len&&b.along<=len+1.2&&
     a.cross<=box.halfWidth*.95&&b.cross<=box.halfWidth*1.1)
     return {id:box.id,kind:"box",impulse:clamp(2.65+speed*.12,3.2,4.6)};
 }
 return null;
}

export function beginAlpineTrick(
 state:AlpineTrickState,takeoff:AlpineTakeoff,now:number,speed:number,
):AlpineTrickState{
 if(state.phase==="air"||!Number.isFinite(now)||!Number.isFinite(speed)||
   speed<3||!Number.isFinite(takeoff.impulse)||takeoff.impulse<=0)return state;
 return {...state,phase:"air",feature:takeoff.id,kind:takeoff.kind,
   startedAt:now,takeoffSpeed:speed,airtime:0,peakClearance:0,
   grab:"none",grabSeconds:0,spinDegrees:0,lastSpinAt:-Infinity,
   attempts:state.attempts+1,lastLabel:"",lastQuality:""};
}

export function alpineGrab(state:AlpineTrickState,hand:AlpineGrab):AlpineTrickState{
 return state.phase==="air"?{...state,grab:hand}:state;
}

/** Bounded discrete 180-degree input. Holding J/L cannot queue dozens of
 * rotations, and left/right controls cannot alter actual travel direction. */
export function alpineSpin(
 state:AlpineTrickState,direction:-1|1,now:number,
):AlpineTrickState{
 if(state.phase!=="air"||!Number.isFinite(now)||now<state.startedAt||
  now-state.startedAt<.08||now-state.lastSpinAt<.17)return state;
 const spin=clamp(state.spinDegrees+180*direction,-720,720);
 return spin===state.spinDegrees?state:
   {...state,spinDegrees:spin,lastSpinAt:now};
}

export function advanceAlpineTrick(
 state:AlpineTrickState,dt:number,clearance:number,
):AlpineTrickState{
 if(state.phase!=="air")return state;
 if(!Number.isFinite(dt)||dt<0||dt>.36||!Number.isFinite(clearance))
   return state;
 return {...state,airtime:state.airtime+dt,
   peakClearance:Math.max(state.peakClearance,Math.max(0,clearance)),
   grabSeconds:state.grabSeconds+(state.grab==="none"?0:dt)};
}

export function alpineTrickPose(state:AlpineTrickState,now:number){
 if(state.phase!=="air")return {yaw:0,crouch:0,grab:"none" as AlpineGrab};
 const t=clamp((now-state.startedAt)/Math.max(.55,
   Math.abs(state.spinDegrees)/180*.22),0,1);
 const eased=t*t*(3-2*t);
 return {yaw:state.spinDegrees*Math.PI/180*eased,
   crouch:.20*(1-eased),grab:state.grab};
}

export function landAlpineTrick(
 state:AlpineTrickState,now:number,speed:number,safe:boolean,
):AlpineTrickState{
 if(state.phase!=="air"||!Number.isFinite(now)||!Number.isFinite(speed))return state;
 const airtime=Math.max(state.airtime,now-state.startedAt);
 const rotations=Math.abs(state.spinDegrees)/180;
 // A physically completed spin needs enough observed time for that many
 // half-turns. Instant key spam cannot claim a 720 on a short box pop.
 const enoughSpinTime=airtime>=rotations*.22+.08;
 const valid=!!safe&&airtime>=.18&&state.peakClearance>=.15&&
   speed>=1.75&&enoughSpinTime;
 const cleared={...state,phase:valid?"landed" as const:"bailed" as const,
   grab:"none" as const,airtime,lastLandedAt:now,
   lastQuality:valid?(speed>=4?"clean" as const:"rough" as const):"bail" as const};
 if(!valid)return {...cleared,combo:0,score:0,bails:state.bails+1,
   lastLabel:"Bail"};
 const combo=now-state.lastLandedAt<=5&&state.lastQuality!=="bail"?
   Math.min(6,state.combo+1):1;
 const label=state.kind==="halfpipe"?"Halfpipe air":
   state.kind==="kicker"?"Snow kicker":
   state.kind==="box"?"Box pop":"Rail dismount";
 const grab=state.grabSeconds>=.12?" + grab":"";
 const spin=rotations>0?" + "+Math.abs(state.spinDegrees)+"°":"";
 const base=65+Math.round(airtime*75)+
   Math.round(state.peakClearance*16)+
   (grab?70:0)+rotations*85+(state.kind==="halfpipe"?30:0);
 const score=state.score+Math.round(base*combo);
 return {...cleared,landings:state.landings+1,score,
   best:Math.max(score,state.best),combo,lastLabel:label+spin+grab};
}

/** Normal travel / teleport / mode changes cannot be counted as touchdown. */
export function cancelAlpineTrick(state:AlpineTrickState):AlpineTrickState{
 return state.phase==="air"?{...state,phase:"bailed",
   bails:state.bails+1,combo:0,score:0,grab:"none",
   lastQuality:"bail",lastLabel:"Interrupted"}:state;
}
