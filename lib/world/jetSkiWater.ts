/** Arcade wave height, directional swell, and coastal current field.
 * Water effects are world-unit hypotheses, not actual tide/rip-current data.
 * Race-only sampling avoids disturbing snorkeling and marine ecology physics.
 */
import type {Point} from "./model";
export type JetSkiWaterSample={height:number;slopeX:number;slopeZ:number;
 roughness:number;current:Point;surge:number;};
export type JetSkiWaterRegion={id:string;center:Point;radius:number;
 roughness:number;current:Point;};
export const JET_SKI_WATER_REGIONS:readonly JetSkiWaterRegion[]=[
 {id:"lagoon-calm",center:{x:75,z:12},radius:29,roughness:.24,
  current:{x:0,z:.12}},
 {id:"north-swell",center:{x:0,z:88},radius:62,roughness:.85,
  current:{x:-.42,z:0}},
 {id:"mendocino-cross-current",center:{x:-60,z:-10},radius:74,
  roughness:1.13,current:{x:-.13,z:-.67}},
 {id:"hawaii-lava-surge",center:{x:10,z:-127},radius:57,
  roughness:1.35,current:{x:.78,z:.12}},
 {id:"east-reef-return",center:{x:75,z:-55},radius:53,
  roughness:.55,current:{x:0,z:.3}},
];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function jetSkiWaterSample(point:Point,time:number):JetSkiWaterSample{
 const x=point.x,z=point.z,t=Number.isFinite(time)?time:0;
 let roughness=.34,currentX=0,currentZ=0;
 for(const region of JET_SKI_WATER_REGIONS){
  const r=Math.hypot(x-region.center.x,z-region.center.z)/region.radius;
  const weight=(1-clamp(r,0,1))**2*(3-2*(1-clamp(r,0,1)));
  roughness+=region.roughness*weight;
  currentX+=region.current.x*weight;
  currentZ+=region.current.z*weight;
 }
 const s1=.105*x+.17*z-1.9*t,s2=-.19*x+.075*z-2.5*t;
 const s3=.34*x-.21*z+3.8*t;
 const amplitude=.11+.2*clamp(roughness,0,1.7);
 const a=amplitude*.65,b=amplitude*.3,c=amplitude*.12;
 const height=a*Math.sin(s1)+b*Math.sin(s2)+c*Math.sin(s3);
 const slopeX=a*.105*Math.cos(s1)-b*.19*Math.cos(s2)+c*.34*Math.cos(s3);
 const slopeZ=a*.17*Math.cos(s1)+b*.075*Math.cos(s2)-c*.21*Math.cos(s3);
 return {height,slopeX,slopeZ,roughness:clamp(roughness,.2,2),
  current:{x:currentX,z:currentZ},
  surge:Math.max(0,Math.cos(s1))*clamp(roughness/1.6,0,1)};
}
/** Predictable authored wave-lip corridors, usable with or without turbo.
 * Each coordinate lies on the marked race, so the jump is intentional.
 * The timer cooldown prevents every nearby substep from relaunching the ski. */
export type JetSkiJump={id:string;point:Point;radius:number;heading:number;
 minSpeed:number;impulse:number;};
export const JET_SKI_JUMPS:readonly JetSkiJump[]=[
 {id:"north-swell-hop",point:{x:27,z:87.5},radius:8,
  heading:-Math.PI/2,minSpeed:14,impulse:3.2},
 {id:"south-lava-launch",point:{x:-5,z:-127},radius:10,
  heading:Math.PI/2,minSpeed:15,impulse:4.1},
];
export function jetSkiJumpAt(point:Point,heading:number,speed:number):
 JetSkiJump|null{
 if(speed<=0)return null;
 for(const jump of JET_SKI_JUMPS){
  const angle=Math.atan2(Math.sin(heading-jump.heading),
   Math.cos(heading-jump.heading));
  if(speed>=jump.minSpeed&&Math.abs(angle)<.65&&
   Math.hypot(point.x-jump.point.x,point.z-jump.point.z)<jump.radius)return jump;
 }
 return null;
}
