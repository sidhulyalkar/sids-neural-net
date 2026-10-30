import type {Point} from './model';

export type ShastaTrick = 'sit'|'down'|'stay'|'spin-left'|'spin-right'|
  'roll-left'|'roll-right'|'shake-left'|'shake-right'|'jump'|'park-it';
export type ShastaAction = 'go'|'come'|ShastaTrick;
export type ShastaTrickPhase='idle'|'approach'|'perform'|'hold'|'recover';
export type ShastaTrickState={
  trick:ShastaTrick|null;phase:ShastaTrickPhase;since:number;
  approachUntil:number;goal:Point|null;finalGoal:Point|null;
};
export const idleShastaTrick=():ShastaTrickState=>({
  trick:null,phase:'idle',since:0,approachUntil:0,goal:null,finalGoal:null,
});
const clamp=(x:number)=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const pulse=(x:number,a:number,b:number,c:number,d:number)=>
  smooth((x-a)/(b-a))*(1-smooth((x-c)/(d-c)));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export const SHASTA_TRICK_DURATION:Readonly<Record<ShastaTrick,number>>={
  sit:.85,down:1.1,stay:.4,'spin-left':1.65,'spin-right':1.65,
  'roll-left':2.35,'roll-right':2.35,'shake-left':1.55,
  'shake-right':1.55,jump:1.45,'park-it':1.1,
};
export type ShastaTrickPose={
  crouch:number;roll:number;spin:number;jump:number;
  pawLeft:number;pawRight:number;head:number;headYaw:number;
  sit:number;down:number;weightShift:number;turnStep:number;tuck:number;
  still:boolean;
};
const REST:ShastaTrickPose={
  crouch:0,roll:0,spin:0,jump:0,pawLeft:0,pawRight:0,
  head:0,headYaw:0,sit:0,down:0,weightShift:0,turnStep:0,tuck:0,still:false,
};
/** The approach is path-based and bounded, never a teleport to the player. */
export function beginShastaTrick(
 trick:ShastaTrick,now:number,dog:Point,player:Point,heading:Point,
):ShastaTrickState{
 const forward=heading.x*heading.x+heading.z*heading.z>.1?heading:{x:0,z:1};
 const finalGoal=trick==='park-it'?{
  x:player.x-forward.x*.38,z:player.z-forward.z*.38,
 }:null;
 const side=Math.sign((dog.x-player.x)*forward.z-(dog.z-player.z)*forward.x)||1;
 const parkVia=finalGoal?{
  x:player.x-forward.x*1.9+forward.z*side*1.3,
  z:player.z-forward.z*1.9-forward.x*side*1.3,
 }:null;
 const goal=parkVia??(trick==='shake-left'||trick==='shake-right'?
  {x:player.x+forward.x*1.55,z:player.z+forward.z*1.55}:null);
 const shouldApproach=goal!==null&&(distance(dog,goal)>1.1||finalGoal!==null);
 return {trick,phase:shouldApproach?'approach':'perform',since:now,
  approachUntil:now+12,goal,finalGoal};
}
/** Interruptible, one-shot actions with persistent held postures. */
export function stepShastaTrick(
 state:ShastaTrickState,now:number,dog:Point,allowed:boolean,
):ShastaTrickState{
 if(!allowed||state.phase==='idle')return idleShastaTrick();
 if(state.phase==='approach'){
  if(now>=state.approachUntil)return idleShastaTrick();
  if(state.goal&&distance(dog,state.goal)>.7)return state;
  if(state.finalGoal)return {...state,goal:state.finalGoal,finalGoal:null};
  return {...state,phase:'perform',since:now};
 }
 if(state.phase==='perform'&&now-state.since>=SHASTA_TRICK_DURATION[state.trick!]){
  if(['sit','down','stay','park-it'].includes(state.trick!))
   return {...state,phase:'hold',since:now};
  return {...state,phase:'recover',since:now};
 }
 if(state.phase==='recover'&&now-state.since>.48)return idleShastaTrick();
 return state;
}
/** Authored stages approximate canine weight transfer and foot contact.
 * These are artist-derived timing curves, not measured motion-capture data.
 * Position channels reset on interruption; full-body rotations finish a
 * complete revolution before recovery to avoid orientation discontinuities.
 */
export function shastaTrickPose(s:ShastaTrickState,now:number):ShastaTrickPose{
 const t=s.trick;
 if(!t||s.phase==='idle'||s.phase==='approach')return {...REST};
 const elapsed=Math.max(0,now-s.since);
 const hold=s.phase==='hold',perform=s.phase==='perform';
 const duration=SHASTA_TRICK_DURATION[t];
 const phase=hold?1:perform?clamp(elapsed/duration):1;
 const fade=s.phase==='recover'?1-smooth(elapsed/.48):1;
 const sit=t==='sit',down=t==='down'||t==='park-it';
 const rolling=t==='roll-left'||t==='roll-right';
 const spinning=t==='spin-left'||t==='spin-right';
 const shaking=t==='shake-left'||t==='shake-right';
 const jumping=t==='jump';
 const direction=t.endsWith('left')?-1:1;
 const settle=smooth(phase/(sit?.9:down?.86:1));
 // Lower to the chest first, roll through the shoulder/back, then right
 // the body. The old version rotated a rigid standing dog 360 degrees.
 const rollProgress=rolling?smooth((elapsed-.34)/1.58):0;
 const roll=rolling?direction*Math.PI*2*rollProgress:0;
 const rollSettle=rolling?pulse(elapsed,0,.35,1.87,2.3):0;
 const spin=spinning?direction*Math.PI*2*smooth(phase):0;
 const shakeLift=shaking?pulse(elapsed,.22,.52,1.09,1.42)*fade:0;
 const prep=jumping?pulse(elapsed,0,.22,.31,.49):0;
 const flight=jumping&&perform?Math.sin(Math.PI*clamp((elapsed-.29)/.92)):0;
 const tuck=jumping?pulse(elapsed,.3,.56,.99,1.26):0;
 const poseSit=sit?settle*fade:shaking?.60*shakeLift:0;
 const poseDown=down?settle*fade:rollSettle*fade;
 const weightShift=shaking?(t==='shake-left'?-1:1)*.08*shakeLift:0;
 return {
  crouch:(poseSit*.64+poseDown*.90+prep*.55)*fade,
  sit:poseSit,down:poseDown,
  roll,spin,jump:flight*.65,
  pawLeft:t==='shake-left'?.34*shakeLift:0,
  pawRight:t==='shake-right'?.34*shakeLift:0,
  head:shaking?.08*shakeLift:rolling?-.12*rollSettle:down?-.07*settle:jumping?-.07*prep:0,
  headYaw:shaking?.12*weightShift:0,
  weightShift,turnStep:spinning&&perform?Math.sin(phase*Math.PI*7)*.085:0,
  tuck:tuck*.13,
  still:hold||perform,
 };
}
export const isShastaTrick=(c:ShastaAction):c is ShastaTrick=>
 !(['go','come'] as string[]).includes(c);
