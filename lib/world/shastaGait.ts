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
 // Keep foot reach within the elbow/stifle's physically valid side.
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
/** Leg solver in the local forward-Z / vertical-Y plane.
 * Facing +Z: the fore elbow flexes toward -Z (behind the shoulder).
 * A dog's hind leg needs three visible links: hip -> forward stifle ->
 * rearward hock -> forward-pointing paw. Treating the hind hock as a
 * second knee generated the backward-folding legs in the screenshot.
 * This is stylized reach-limited IK, not a measured veterinary skeleton.
 */
export type ShastaLegJoint={y:number;z:number};
export type ShastaLegIK={
 hip:ShastaLegJoint;knee:ShastaLegJoint;
 hock:ShastaLegJoint|null;paw:ShastaLegJoint;
};
export const SHASTA_LEG_LENGTHS={
 fore:{upper:.45,lower:.44},
 hind:{upper:.44,lower:.45,hockToPawZ:.16,hockToPawY:.22},
} as const;
export function shastaLegIK(hipZ:number,footZ:number,footY:number,
 fore:boolean,hipY=fore?.77:.82):ShastaLegIK{
 // The camera-visible foot is reach-limited; extreme swing/terrain
 // targets otherwise force the inverse knee onto the wrong hinge branch.
 // Renderer uses this returned paw position for its toe pads too.
 const hip={z:hipZ,y:hipY},
  paw={z:hipZ+clamp(footZ-hipZ,-.18,.18),y:footY};
 const proportions=fore?SHASTA_LEG_LENGTHS.fore:SHASTA_LEG_LENGTHS.hind;
 // The hind hock stays behind and above the toes. Its third segment
 // remains forward-leaning at walk, trot and canter.
 const desiredEnd=fore?paw:{
  z:paw.z-SHASTA_LEG_LENGTHS.hind.hockToPawZ,
  y:paw.y+SHASTA_LEG_LENGTHS.hind.hockToPawY,
 };
 const dz=desiredEnd.z-hipZ,dy=desiredEnd.y-hipY;
 const rawDistance=Math.hypot(dz,dy);
 const unitZ=rawDistance>1e-8?dz/rawDistance:0;
 const unitY=rawDistance>1e-8?dy/rawDistance:-1;
 const upper=proportions.upper,lower=proportions.lower;
 const distance=clamp(rawDistance,
  Math.abs(upper-lower)+.001,upper+lower-.001);
 const end={
  z:hipZ+unitZ*distance,y:hipY+unitY*distance,
 };
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
 const sideways=Math.sqrt(Math.max(0,upper*upper-along*along));
 // Perpendicular orientation matters: fore elbows behind (-Z),
 // hind stifles ahead (+Z) of the hip-to-hock line.
 const bend=fore?-1:1;
 const knee={
  z:hipZ+unitZ*along-unitY*sideways*bend,
  y:hipY+unitY*along+unitZ*sideways*bend,
 };
 return {hip,knee,hock:fore?null:end,paw};
}
