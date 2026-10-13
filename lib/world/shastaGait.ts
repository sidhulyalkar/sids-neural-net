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
const smooth=(a:number,b:number,x:number)=>{
 const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);
};
const mod=(x:number,y:number)=>((x%y)+y)%y;
export function shastaGaitForSpeed(speed:number):ShastaGait{
 return speed<.3?"stand":speed<3.25?"walk":speed<8.5?"trot":"canter";
}
export function shastaStrideLength(speed:number){
 return speed<3.25?.64:speed<8.5?.93:1.25;
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
 const stride=gait==="walk"?.17:gait==="trot"?.23:.30;
 const duty=gait==="walk"?.69:gait==="trot"?.59:.48;
 // Paw order: left hind, left fore, right hind, right fore.
 const offsets=gait==="walk"?[0,.5,.74,.25]:
  gait==="trot"?[0,.5,.5,0]:[0,.14,.53,.63];
 const legs=offsets.map((shift,i):ShastaFoot=>{
  const f=mod(phase/(2*Math.PI)+shift,1);
  const stance=f<duty;
  const t=stance?f/duty:(f-duty)/(1-duty);
  // During stance paws translate backward relative to the torso (world-paw
  // velocity approximately zero). Swing advances through a low arc.
  const z=stance?stride*(1-2*t):-stride*Math.cos(Math.PI*t);
  const lift=stance?0:(.08+(gait==="canter"?.06:0))*Math.sin(Math.PI*t);
  return {x:(i<2?-.2:.2),y:.055+moving*lift,
   z:(i%2===1?.44:-.44)+z*moving,stance};
 });
 // This is the fix for the hop: the body never inherits a large sinusoidal
 // step amplitude. High-speed flex is <3cm; walk/trot have smaller travel.
 const bodyBob=(gait==="stand"?0:gait==="canter"?.019:.008)*
  moving*Math.sin(phase*2);
 const bodyPitch=(gait==="canter"?.027:.012)*moving*Math.sin(phase);
 return {gait,phase,blend:moving,bodyBob,bodyPitch,
  strideLength:length,feet:legs as unknown as ShastaGaitPose["feet"]};
}
/** Two-bone hind/fore limb IK in the Z/Y plane, with bounded joints.
 * Foot positions are in a body-local frame. */
export function shastaLegIK(hipZ:number,footZ:number,footY:number,
 fore:boolean,hipY=.77){
 const upper=.42,lower=.38;
 const dz=footZ-hipZ,dy=footY-hipY;
 const distance=clamp(Math.hypot(dz,dy),.035,upper+lower-.001);
 const inv=1/Math.max(1e-8,Math.hypot(dz,dy));
 const uz=dz*inv,uy=dy*inv;
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
 const perpendicular=Math.sqrt(Math.max(0,upper*upper-along*along));
 const sign=fore?1:-1;
 const kneeZ=hipZ+uz*along-uy*perpendicular*sign;
 const kneeY=hipY+uy*along+uz*perpendicular*sign;
 return {hip:{y:hipY,z:hipZ},knee:{y:kneeY,z:kneeZ},
  paw:{y:footY,z:footZ}};
}
