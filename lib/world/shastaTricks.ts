import type {Point} from './model';

export type ShastaTrick = 'sit'|'down'|'stay'|'spin-left'|'spin-right'|
  'roll-left'|'roll-right'|'shake-left'|'shake-right'|'jump'|'park-it';
export type ShastaAction = 'go'|'come'|ShastaTrick;
export type ShastaTrickPhase='idle'|'approach'|'perform'|'hold'|'recover';
export type ShastaTrickState={
  trick:ShastaTrick|null;phase:ShastaTrickPhase;since:number;
  approachUntil:number;goal:Point|null;
};
export const idleShastaTrick=():ShastaTrickState=>({
  trick:null,phase:'idle',since:0,approachUntil:0,goal:null,
});
const smooth=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const duration:Record<ShastaTrick,number>={
 'sit':.85,'down':1,'stay':.4,'spin-left':1.4,'spin-right':1.4,
 'roll-left':2.15,'roll-right':2.15,'shake-left':1.25,
 'shake-right':1.25,'jump':1.45,'park-it':1.3,
};
/** A new command explicitly interrupts the previous action; there are no
 * background queues and no surprise retries after a world-mode switch. */
export function beginShastaTrick(
 trick:ShastaTrick,now:number,dog:Point,player:Point,heading:Point,
):ShastaTrickState{
 const forward=heading.x*heading.x+heading.z*heading.z>.1?heading:{x:0,z:1};
 // Park-it approaches from behind, then settles between the player's feet.
 const goal=trick==='park-it'?{
  x:player.x-forward.x*.38,z:player.z-forward.z*.38,
 }:trick==='shake-left'||trick==='shake-right'?
 {x:player.x+forward.x*1.55,z:player.z+forward.z*1.55}:null;
 const shouldApproach=goal!==null&&distance(dog,goal)>1.1;
 return {trick,phase:shouldApproach?'approach':'perform',since:now,
  approachUntil:now+9,goal};
}
export function stepShastaTrick(
 state:ShastaTrickState,now:number,dog:Point,allowed:boolean,
):ShastaTrickState{
 if(!allowed||state.phase==='idle')return idleShastaTrick();
 if(state.phase==='approach'){
  if(state.goal&&distance(dog,state.goal)>.7&&now<state.approachUntil)return state;
  return {...state,phase:'perform',since:now};
 }
 if(state.phase==='perform'&&now-state.since>=duration[state.trick!]){
  if(['sit','down','stay','park-it'].includes(state.trick!))
   return {...state,phase:'hold',since:now};
  return {...state,phase:'recover',since:now};
 }
 if(state.phase==='recover'&&now-state.since>.45)return idleShastaTrick();
 return state;
}
export function shastaTrickPose(s:ShastaTrickState,now:number){
 const elapsed=Math.max(0,now-s.since);
 const t=s.trick;
 if(!t||s.phase==='idle'||s.phase==='approach')
  return {crouch:0,roll:0,spin:0,jump:0,pawLeft:0,pawRight:0,head:0,still:false};
 const live=s.phase==='perform',hold=s.phase==='hold';
 const progress=smooth(elapsed/duration[t]);
 const recover=s.phase==='recover'?1-smooth(elapsed/.45):1;
 const sustained=hold?1:live?progress:recover;
 const roll=(t==='roll-left'?-1:t==='roll-right'?1:0)*
  (live?Math.PI*2*smooth(elapsed/2.15):s.phase==='recover'?0:0);
 const spin=(t==='spin-left'?-1:t==='spin-right'?1:0)*
  (live?Math.PI*2*smooth(elapsed/1.4):0);
 const jump=t==='jump'&&live?Math.sin(Math.PI*Math.min(1,elapsed/1.45))*.72:0;
 const down=['down','park-it','roll-left','roll-right'].includes(t);
 const pawLeft=t==='shake-left'?Math.sin(Math.PI*Math.min(1,elapsed/1.25))*.39*recover:0;
 const pawRight=t==='shake-right'?Math.sin(Math.PI*Math.min(1,elapsed/1.25))*.39*recover:0;
 return {
  crouch:(down?.72:t==='sit'?.45:0)*sustained,
  roll,spin,jump,pawLeft,pawRight,
  head:(t==='shake-left'||t==='shake-right'?.13:down?-.06:0)*sustained,
  still:hold||live,
 };
}
export const isShastaTrick=(c:ShastaAction):c is ShastaTrick=>
 !(['go','come'] as string[]).includes(c);
