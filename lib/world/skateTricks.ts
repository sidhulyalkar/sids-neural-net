/**
 * Pure Skate-style trick model. Original timing/score rules. Renderer supplies
 * the physical launch and authoritative ground contact, not frame count.
 */
export type SkateTrickName="Ollie"|"Nollie"|"Kickflip"|"Heelflip"|"Pop Shuvit"|"360 Shuvit"|"Tre Flip";
export type SkateTrickState={
 phase:"ground"|"air";name:SkateTrickName|null;startedAt:number;
 flip:number;shove:number;points:number;combo:number;best:number;
 lastLandedAt:number;lastLabel:string;bails:number;grab:"none"|"left"|"right";
};
export const SKATE_FLIP_SECONDS=0.66;
export function idleSkateTrick():SkateTrickState{
 return {phase:"ground",name:null,startedAt:0,flip:0,shove:0,points:0,combo:0,best:0,
  lastLandedAt:-Infinity,lastLabel:"",bails:0,grab:"none"};
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
export function startSkateTrick(state:SkateTrickState,name:SkateTrickName,now:number,speed:number):SkateTrickState{
 if(state.phase!=="ground"||!Number.isFinite(now)||speed<0)return state;
 const trick=specs[name];
 return {...state,phase:"air",name,startedAt:now,flip:trick.flip,shove:trick.shove,grab:"none"};
}
export function setSkateGrab(state:SkateTrickState,hand:"none"|"left"|"right"):SkateTrickState{
 return state.phase==="air"?{...state,grab:hand}:state;
}
export function skateTrickPose(state:SkateTrickState,now:number){
 const t=state.phase==="air"?Math.max(0,Math.min(1,(now-state.startedAt)/SKATE_FLIP_SECONDS)):0;
 const e=t*t*(3-2*t);
 return {roll:Math.PI*2*state.flip*e,yaw:Math.PI*state.shove*e,progress:t,
  grab:state.grab};
}
export function finishSkateTrick(state:SkateTrickState,now:number,landingSpeed:number):SkateTrickState{
 if(state.phase!=="air"||!state.name)return state;
 const seconds=Math.max(0,now-state.startedAt);
 // A short landing while the deck is still inverted is a bail. Leave the
 // player riding, but break the line and remove momentum in the renderer.
 const clean=seconds>=SKATE_FLIP_SECONDS*.72;
 if(!clean)return {...state,phase:"ground",name:null,grab:"none",combo:0,points:0,
  lastLabel:"Bail",bails:state.bails+1,lastLandedAt:now};
 const previousCombo=now-state.lastLandedAt<4.5?state.combo:0;
 const combo=previousCombo+1;
 const earned=specs[state.name].score+Math.round(Math.min(20,landingSpeed)*9)+
  (state.grab==="none"?0:65);
 const points=(previousCombo?state.points:0)+earned*combo;
 return {...state,phase:"ground",name:null,grab:"none",combo,points,best:Math.max(state.best,points),
  lastLandedAt:now,lastLabel:state.name+(state.grab==="none"?"":" + "+state.grab+" grab")};
}
/** Right-stick/arrow flick, direction interpreted from an existing crouch. */
export function flickTrick(direction:"up"|"left"|"right",windupSeconds:number):SkateTrickName{
 if(direction==="up")return windupSeconds>=.45?"Nollie":"Ollie";
 if(direction==="left")return windupSeconds>=.45?"Tre Flip":"Kickflip";
 return windupSeconds>=.45?"360 Shuvit":"Heelflip";
}
