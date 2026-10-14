/**
 * Original skateboard trick/line simulation. A pure, deterministic gameplay
 * state machine: measured game behavior is deliberately NOT inferred here.
 * Coordinates/physics belong to the World runtime, while this module owns
 * timing, stance, board tricks, manuals, body rotation and scoring.
 */
export type SkateTrickName="Ollie"|"Nollie"|"Kickflip"|"Heelflip"|"Pop Shuvit"|"360 Shuvit"|"Tre Flip";
export type SkateManual="none"|"manual"|"nose-manual";
export type SkateStance="regular"|"fakie";
export type SkateTrickState={
 phase:"ground"|"air";name:SkateTrickName|null;startedAt:number;
 flip:number;shove:number;points:number;combo:number;best:number;
 lastLandedAt:number;lastLabel:string;bails:number;grab:"none"|"left"|"right";
 spinDegrees:number;stance:SkateStance;assisted:boolean;
 manual:SkateManual;manualDistance:number;manualTime:number;
};
export const SKATE_FLIP_SECONDS=0.66;
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const smooth=(t:number)=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
export function idleSkateTrick():SkateTrickState{
 return {phase:"ground",name:null,startedAt:0,flip:0,shove:0,points:0,combo:0,best:0,
  lastLandedAt:-Infinity,lastLabel:"",bails:0,grab:"none",
  spinDegrees:0,stance:"regular",assisted:false,manual:"none",manualDistance:0,manualTime:0};
}
const specs:Record<SkateTrickName,{flip:number;shove:number;score:number}>={
 Ollie:{flip:0,shove:0,score:30},
 Nollie:{flip:0,shove:0,score:45},
 Kickflip:{flip:1,shove:0,score:110},
 Heelflip:{flip:-1,shove:0,score:110},
 "Pop Shuvit":{flip:0,shove:1,score:90},
 "360 Shuvit":{flip:0,shove:2,score:160},
 "Tre Flip":{flip:1,shove:2,score:280},
};
function award(state:SkateTrickState,label:string,base:number,now:number):SkateTrickState{
 const recent=now-state.lastLandedAt<4.5 && now>=state.lastLandedAt;
 const combo=(recent?state.combo:0)+1;
 const points=(recent?state.points:0)+Math.round(base)*combo;
 return {...state,combo,points,best:Math.max(points,state.best),
  lastLandedAt:now,lastLabel:label};
}
export function startSkateTrick(state:SkateTrickState,name:SkateTrickName,now:number,speed:number,assisted=false):SkateTrickState{
 if(state.phase!=="ground"||!Number.isFinite(now)||!Number.isFinite(speed)||speed<0)return state;
 // A trick can exit a manual without fabricating an extra landing.
 const base=state.manual!=="none"?finishSkateManual(state,now):state;
 const trick=specs[name];
 return {...base,phase:"air",name,startedAt:now,flip:trick.flip,shove:trick.shove,
  grab:"none",spinDegrees:0,assisted,manual:"none",manualDistance:0,manualTime:0};
}
export function setSkateGrab(state:SkateTrickState,hand:"none"|"left"|"right"):SkateTrickState{
 return state.phase==="air"&&state.name?{...state,grab:hand}:state;
}
/** Commands are accumulated in half-turns. No infinite spin spam or teleport. */
export function queueSkateSpin(state:SkateTrickState,direction:-1|1,now:number):SkateTrickState{
 if(state.phase!=="air"||!state.name||!Number.isFinite(now)||
  now<state.startedAt||now-state.startedAt>.37)return state;
 const degrees=clamp(state.spinDegrees+180*direction,-360,360);
 return degrees===state.spinDegrees?state:{...state,spinDegrees:degrees};
}
export function skateTrickPose(state:SkateTrickState,now:number){
 const duration=Math.max(state.assisted ? 0.44 : SKATE_FLIP_SECONDS,Math.abs(state.spinDegrees)/360*.78);
 const progress=state.phase==="air"?clamp((now-state.startedAt)/duration,0,1):0;
 const e=smooth(progress);
 const baseYaw=state.stance==="fakie"?Math.PI:0;
 const air=state.phase==="air";
 return {
  roll:air?Math.PI*2*state.flip*e:0,
  yaw:air?Math.PI*state.shove*e:0,
  bodyYaw:baseYaw+(air?state.spinDegrees*Math.PI/180*e:0),
  pitch:state.manual==="manual"?-.16:state.manual==="nose-manual"?.16:0,
  crouch:air?Math.max(0,.28*(1-e)):state.manual!=="none"?.10:0,
  progress,grab:state.grab,
 };
}
export function finishSkateTrick(state:SkateTrickState,now:number,landingSpeed:number):SkateTrickState{
 if(state.phase!=="air"||!state.name||!Number.isFinite(now))return state;
 const seconds=Math.max(0,now-state.startedAt);
 const duration=Math.max(state.assisted ? 0.44 : SKATE_FLIP_SECONDS,Math.abs(state.spinDegrees)/360*.78);
 // Assisted tricks complete their catch slightly earlier. Truly premature
 // touchdown still bails, so the rider never banks an unperformed flip.
 const clean=seconds>=duration*(state.assisted ? .76 : .72);
 const base={...state,phase:"ground" as const,name:null,grab:"none" as const,
  spinDegrees:0,assisted:false,manual:"none" as const,manualDistance:0,manualTime:0};
 if(!clean)return {...base,combo:0,points:0,lastLabel:"Bail",
  bails:state.bails+1,lastLandedAt:now};
 const rotate=Math.abs(state.spinDegrees);
 const flipped=rotate%360===180;
 const stance:SkateStance=flipped?
   state.stance==="regular"?"fakie":"regular":state.stance;
 const label=state.name+(rotate?" + "+rotate+"°":"")+
  (state.grab==="none"?"":" + "+state.grab+" grab")+
  (flipped?" · fakie":"");
 const earned=specs[state.name].score+Math.round(clamp(landingSpeed,0,20)*9)+
   (state.grab==="none"?0:65)+(rotate===180?115:rotate>=360?210:0);
 return award({...base,stance},label,earned,now);
}
/** Key and right-stick Flick interpretation from a held crouch. */
export function flickTrick(direction:"up"|"left"|"right",windupSeconds:number):SkateTrickName{
 if(direction==="up")return windupSeconds>=.45?"Nollie":"Ollie";
 if(direction==="left")return windupSeconds>=.45?"Tre Flip":"Kickflip";
 return windupSeconds>=.45?"360 Shuvit":"Heelflip";
}
/** Manuals start only on grounded wheels with nonzero travel. */
export function startSkateManual(state:SkateTrickState,kind:Exclude<SkateManual,"none">,speed:number):SkateTrickState{
 if(state.phase!=="ground"||state.manual!=="none"||speed<2||
  !Number.isFinite(speed))return state;
 return {...state,manual:kind,manualDistance:0,manualTime:0};
}
export function stepSkateManual(state:SkateTrickState,dt:number,speed:number,now:number):SkateTrickState{
 if(state.manual==="none"||state.phase!=="ground")return state;
 if(speed<1.35)return finishSkateManual(state,now);
 const elapsed=clamp(dt,0,.05);
 const next={...state,manualTime:state.manualTime+elapsed,
  manualDistance:state.manualDistance+Math.max(0,speed)*elapsed};
 return next.manualTime>=5?finishSkateManual(next,now):next;
}
export function finishSkateManual(state:SkateTrickState,now:number):SkateTrickState{
 if(state.manual==="none")return state;
 const {manual,manualDistance}=state;
 const base={...state,manual:"none" as const,manualTime:0,manualDistance:0};
 if(manualDistance<2.4)return base;
 const label=manual==="manual"?"Manual":"Nose manual";
 return award(base,label,Math.round(manualDistance*13+45),now);
}
/** Grinding scores only covered distance; a camera-nearby rail never scores. */
export function scoreSkateGrind(state:SkateTrickState,meters:number,style:"fifty-fifty"|"boardslide",now:number):SkateTrickState{
 if(!Number.isFinite(meters)||meters<.5||state.phase!=="ground")return state;
 const label=style==="boardslide"?"Boardslide":"50-50";
 return award(state,label,(60+meters*12)*(style==="boardslide"?1.3:1),now);
}
