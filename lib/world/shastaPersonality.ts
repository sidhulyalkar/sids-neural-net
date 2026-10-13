/** Event-driven Shasta personality, with one authored snow celebration on
 * selecting Ski. No randomness, invisible teleports, or infinite zoomies.
 * Reference videos support curiosity, deliberate paw placement and relaxed
 * grass rolling; snow behavior is explicitly creative interpretation.
 */
export type ShastaSnowStage="idle"|"perk"|"zoom"|"roll"|"shake"|"rejoin";
export type ShastaSnowPlay={stage:ShastaSnowStage;started:number;seed:number;queued:boolean};
export const idleShastaSnowPlay=():ShastaSnowPlay=>({
 stage:"idle",started:0,seed:0,queued:false,
});
export const queueShastaSnowPlay=(state:ShastaSnowPlay):ShastaSnowPlay=>({
 ...state,queued:true,
});
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const curve=(a:number,b:number,t:number)=>{
 const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);
};
export type ShastaSnowPose={
 stage:ShastaSnowStage;motion:number;roll:number;crouch:number;
 wag:number;headTilt:number;circle:number;done:boolean;
};
/** Only begin the celebration on actual mountain snow, when Shasta can
 * safely move nearby. Input and other minigames always take priority. */
export function stepShastaSnowPlay(state:ShastaSnowPlay,
 now:number,inSnow:boolean,allowed:boolean):ShastaSnowPlay{
 if(!allowed)return idleShastaSnowPlay();
 if(state.stage==="idle"){
  return state.queued&&inSnow?{
   stage:"perk",started:now,seed:state.seed+1,queued:false}:state;
 }
 const t=Math.max(0,now-state.started);
 const stage:ShastaSnowStage=t<.8?"perk":t<3.6?"zoom":
  t<6.25?"roll":t<7.35?"shake":t<8.7?"rejoin":"idle";
 return stage==="idle"?idleShastaSnowPlay():{...state,stage};
}
export function shastaSnowPose(state:ShastaSnowPlay,now:number):ShastaSnowPose{
 const stage=state.stage;
 const t=Math.max(0,now-state.started);
 if(stage==="idle")return {stage,motion:0,roll:0,crouch:0,wag:0,
  headTilt:0,circle:0,done:true};
 if(stage==="perk")return {stage,motion:0,roll:0,crouch:.10,
  wag:1.2,headTilt:-.13, circle:0,done:false};
 if(stage==="zoom"){
  const u=clamp((t-.8)/2.8,0,1);
  return {stage,motion:4.7+2.4*Math.sin(u*Math.PI),roll:0,crouch:0,
   wag:2,headTilt:0,circle:u*Math.PI*3,done:false};
 }
 if(stage==="roll"){
  const u=clamp((t-3.6)/2.65,0,1);
  const envelope=curve(0,.17,u)*(1-curve(.84,1,u));
  // A single side-roll into a back rub and back upright. The arc begins
  // and ends at zero rotation without discontinuity across stage boundaries.
  const angle=Math.PI*2*curve(0,1,u);
  return {stage,motion:0,roll:angle*envelope,crouch:.19*envelope,
   wag:1.4,headTilt:.05*Math.sin(u*13),circle:Math.PI*3,done:false};
 }
 if(stage==="shake")return {stage,motion:0,roll:0,crouch:0,
  wag:2.4,headTilt:.14*Math.sin((t-6.25)*22),circle:Math.PI*3,done:false};
 return {stage,motion:0,roll:0,crouch:0,
  wag:1,headTilt:0,circle:Math.PI*3,done:false};
}
