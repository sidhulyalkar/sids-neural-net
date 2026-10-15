/** Shasta's authored, video-informed quadruped motion.
 * Lengths are stylized World units, NOT measurements extracted from videos.
 * Stride phase is driven by distance travelled rather than wall-clock time.
 * Torso stays grounded; individual paws provide vertical swing clearance.
 */
export type ShastaGait="stand"|"walk"|"trot"|"canter";
export type ShastaFoot={x:number;y:number;z:number;stance:boolean};
export type ShastaGaitPose={
 gait:ShastaGait;phase:number;blend:number;bodyBob:number;bodyPitch:number;
 strideLength:number;feet:readonly [ShastaFoot,ShastaFoot,ShastaFoot,ShastaFoot];
};
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const mod=(x:number,y:number)=>((x%y)+y)%y;
export function shastaGaitForSpeed(speed:number):ShastaGait{
 return speed<.3?"stand":speed<3.25?"walk":speed<8.5?"trot":"canter";
}
const smoothstep=(a:number,b:number,x:number)=>{
 const u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u);
};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Continuous strides across walk/trot/canter speed bands. The old
 * thresholded length snapped the phase speed and paws on every crossover.
 */
export function shastaStrideLength(speed:number){
 const walkToTrot=smoothstep(2.0,4.5,speed);
 const trotToCanter=smoothstep(7.0,10.0,speed);
 return mix(mix(.64,.93,walkToTrot),1.25,trotToCanter);
}
/** Call with *actual displacement* to avoid standing-in-place cycling or
 * artificially rapid footsteps when the dog collides with an obstacle. */
export function advanceShastaStride(phase:number,travelDistance:number,speed:number){
 if(!Number.isFinite(phase)||!Number.isFinite(travelDistance)||!Number.isFinite(speed))
  return 0;
 if(speed<.2||travelDistance<=0)return phase;
 return mod(phase+Math.PI*2*clamp(travelDistance,0,.6)/shastaStrideLength(speed),Math.PI*2);
}
export function shastaGaitPose(speed:number,phase:number,blend:number):ShastaGaitPose{
 const safeSpeed=clamp(Number.isFinite(speed)?speed:0,0,24);
 const moving=clamp(blend,0,1);
 const gait=shastaGaitForSpeed(safeSpeed);
 const length=shastaStrideLength(safeSpeed);
 const walkToTrot=smoothstep(2.0,4.5,safeSpeed);
 const trotToCanter=smoothstep(7.0,10.0,safeSpeed);
 // Compact stride for clean, straight stylized legs.
 const stride=mix(mix(.17,.205,walkToTrot),.24,trotToCanter);
 const duty=mix(mix(.69,.59,walkToTrot),.48,trotToCanter);
 // Paw order: left hind, left fore, right hind, right fore.
 // Blend contact offsets across gait boundaries so speed oscillation
 // around 3.25 or 8.5 never abruptly swaps which paw is planted.
 const walkOffsets=[0,.5,.74,.25],trotOffsets=[0,.5,.5,0],
  canterOffsets=[0,.14,.53,.63];
 const offsets=walkOffsets.map((v,i)=>
  mix(mix(v,trotOffsets[i],walkToTrot),canterOffsets[i],trotToCanter));
 const legs=offsets.map((shift,i):ShastaFoot=>{
  const f=mod(phase/(2*Math.PI)+shift,1);
  const stance=f<duty;
  const t=stance?f/duty:(f-duty)/(1-duty);
  // During stance paws translate backward relative to the torso (world-paw
  // velocity approximately zero). Swing advances through a low arc.
  const z=stance?stride*(1-2*t):-stride*Math.cos(Math.PI*t);
  const lift=stance?0:(.08+.06*trotToCanter)*Math.sin(Math.PI*t);
  return {x:(i<2?-.2:.2),y:.055+moving*lift,
   z:(i%2===1?.44:-.44)+z*moving,stance};
 });
 // This is the fix for the hop: the body never inherits a large sinusoidal
 // step amplitude. High-speed flex is <3cm; walk/trot have smaller travel.
 const bodyBob=(gait==="stand"?0:mix(.008,.016,trotToCanter))*
  moving*Math.sin(phase*2);
 const bodyPitch=mix(.012,.024,trotToCanter)*moving*Math.sin(phase);
 return {gait,phase,blend:moving,bodyBob,bodyPitch,
  strideLength:length,feet:legs as unknown as ShastaGaitPose["feet"]};
}
/** Four simple leg columns replace knee/hock inverse kinematics.
 * Paw coordinates are kept independent so each foot can skim rough terrain
 * without bending joints or altering the stabilized torso. Dimensions are
 * low-poly game art units, not a physiological skeleton.
 */
export type ShastaStraightLeg={
 hip:{y:number;z:number};
 paw:{y:number;z:number};
 length:number;
};
export function shastaStraightLeg(
 hipZ:number,footZ:number,footY:number,fore:boolean,
):ShastaStraightLeg{
 const hip={y:fore?.77:.82,z:hipZ};
 const paw={y:clamp(footY,-.04,.28),
  z:hipZ+clamp(footZ-hipZ,-.28,.28)};
 const length=Math.hypot(hip.y-paw.y,hip.z-paw.z);
 return {hip,paw,length};
}
