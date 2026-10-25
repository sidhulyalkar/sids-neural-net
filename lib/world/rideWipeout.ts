/** A finite arcade wipeout: fall, recover, and resume without a menu. */
export type RideWipeout={age:number;phase:"riding"|"falling"|"down"|"rising"};
export const idleRideWipeout=():RideWipeout=>({age:0,phase:"riding"});
export const beginRideWipeout=():RideWipeout=>({age:0,phase:"falling"});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const ease=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
export function stepRideWipeout(state:RideWipeout,dt:number):RideWipeout{
 if(state.phase==="riding")return state;
 const age=state.age+clamp(Number.isFinite(dt)?dt:0,0,.2);
 if(age>=1.28)return idleRideWipeout();
 return {age,phase:age<.26?"falling":age<.62?"down":"rising"};
}
export function rideWipeoutPose(state:RideWipeout){
 const age=state.age;
 const collapse=state.phase==="riding"?0:age<.26?
  ease(age/.26):age<.62?1:1-ease((age-.62)/.66);
 return {collapse,locked:state.phase!=="riding",tilt:collapse*.98,drop:collapse*.3};
}
