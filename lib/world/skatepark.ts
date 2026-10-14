import {terrainHeight, type Point} from "./model";

/**
 * Original skate plaza on the unused south meadow.
 * Geometry, wheel support, scenery reservations and launch lips share coordinates.
 * All lengths are stylized world units, not measured retail Skate 3 values.
 */
export const SKATE_PARK = {center:{x:-6,z:40},halfWidth:14,halfDepth:12,deckHeight:2.42} as const;
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const x=clamp01(v);return x*x*(3-2*x);};

export function insideSkatePark(p:Point,margin=0):boolean {
 return Math.abs(p.x-SKATE_PARK.center.x)<=SKATE_PARK.halfWidth+margin &&
  Math.abs(p.z-SKATE_PARK.center.z)<=SKATE_PARK.halfDepth+margin;
}

/** One support profile shared by mesh, ground collisions and scenery placement.
 * We raise the exterior wall around a smooth central floor, rather than clip
 * a negative hole under the natural ground. The wood/bark are visual skins,
 * never a hidden second collidable surface. */
export const REDWOOD_BOWL={center:{x:-12,z:40},rimRadius:5.4,barkRadius:6.5} as const;
export const STUMP_PADS=[
 {id:"north-stump",center:{x:-5,z:33.5},radius:1.3,lift:.15},
 {id:"south-stump",center:{x:-5,z:46.5},radius:1.3,lift:.15},
] as const;
export type SkateParkZone="redwood-bowl"|"timber-quarter"|"stump-pad"|"street"|"apron";
export function skateParkZone(p:Point):SkateParkZone{
 if(Math.hypot(p.x-REDWOOD_BOWL.center.x,p.z-REDWOOD_BOWL.center.z)<REDWOOD_BOWL.rimRadius+.85)
  return "redwood-bowl";
 if(STUMP_PADS.some(pad=>Math.hypot(p.x-pad.center.x,p.z-pad.center.z)<pad.radius+.12))
  return "stump-pad";
 if(p.x>=-2&&(p.z<34.4||p.z>45.6))return "timber-quarter";
 if(Math.abs(p.x+1)<3.4&&Math.abs(p.z-40)<4)return "street";
 return "apron";
}
export function skateParkSurface(p:Point):number|null {
 if(!insideSkatePark(p))return null;
 const natural=terrainHeight(p.x,p.z);
 const edge=Math.min(
  SKATE_PARK.halfWidth-Math.abs(p.x-SKATE_PARK.center.x),
  SKATE_PARK.halfDepth-Math.abs(p.z-SKATE_PARK.center.z));
 const blend=smooth(edge/3.5);
 const deck=natural+(Math.max(natural,SKATE_PARK.deckHeight)-natural)*blend;
 const street=smooth((p.x+5)/3);
 const north=smooth((33.8-p.z)/4.2);
 const south=smooth((p.z-46.2)/4.2);
 // Deliberate mirrored timber quarter walls preserve existing real takeoffs.
 const quarters=2.2*Math.max(north*north,south*south)*street;
 const r=Math.hypot(p.x-REDWOOD_BOWL.center.x,p.z-REDWOOD_BOWL.center.z);
 // Slightly deeper tree-carved silhouette, with the same C1 roll-in slope.
 const bank=1.42*smooth((r-.85)/4.55)*(1-smooth((r-REDWOOD_BOWL.rimRadius)/1.9));
 // The east-facing split opening is a shallow, obvious roll-in rather than
 // a physical gate. A rider can enter it even without a timed jump.
 const opening=smooth((p.x+9)/2.5)*(1-smooth(Math.abs(p.z-40.8)/2.15));
 const bowl=bank*(1-.53*opening);
 const pyramid=.66*Math.max(0,1-Math.abs(p.x+1)/2.5)*
  Math.max(0,1-Math.abs(p.z-40)/3.2);
 const stump=STUMP_PADS.reduce((sum,pad)=>{
  const radius=Math.hypot(p.x-pad.center.x,p.z-pad.center.z);
  // The whole medallion is a smooth, low manual pad: no vertical stump edge.
  const plateau=1-smooth((radius-pad.radius*.35)/(pad.radius*.65));
  return sum+pad.lift*plateau;
 },0);
 return Math.max(natural,deck+blend*(quarters+bowl+pyramid+stump));
}
export type SkateRail={
 id:string;a:Point;b:Point;role:"sport";radius:number;lift:number;
};
export const SKATE_PARK_RAILS:readonly SkateRail[]=[
 {id:"park-flat-bar",a:{x:5,z:36},b:{x:5,z:44},role:"sport",radius:0.075,lift:0.54},
 {id:"park-down-rail",a:{x:-2,z:34.3},b:{x:0,z:38.2},role:"sport",radius:0.08,lift:0.52},
 {id:"park-bowl-coping",a:{x:-17,z:39},b:{x:-17,z:43},role:"sport",radius:0.065,lift:0.35},
] as const;
export const SKATE_PARK_LIPS=[
 {id:"park-north-quarter",point:{x:2,z:30.9},heading:{x:0,z:-1},halfWidth:5.7,impulse:5.6},
 {id:"park-south-quarter",point:{x:2,z:49.1},heading:{x:0,z:1},halfWidth:5.7,impulse:5.6},
] as const;

/** Launch only on an actual forward crossing, not on idle proximity or reverse. */
export function skateParkLipCrossing(previous:Point,current:Point,heading:Point,speed:number){
 if(speed<3.2)return null;
 for(const lip of SKATE_PARK_LIPS){
  const dot=heading.x*lip.heading.x+heading.z*lip.heading.z;
  if(dot<0.55)continue;
  const prev=(previous.x-lip.point.x)*lip.heading.x+(previous.z-lip.point.z)*lip.heading.z;
  const next=(current.x-lip.point.x)*lip.heading.x+(current.z-lip.point.z)*lip.heading.z;
  const side=(current.x-lip.point.x)*lip.heading.z-(current.z-lip.point.z)*lip.heading.x;
  if(prev<0&&next>=0&&next<=1.3&&Math.abs(side)<lip.halfWidth)
   return {id:lip.id,impulse:Math.min(7.4,lip.impulse+speed*.12)};
 }
 return null;
}
