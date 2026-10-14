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

/** Continuous heightfield: approach apron, two transition banks, carved bowl
 * and a street pyramid. No hidden collision boxes or per-frame mesh rebuilds. */
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
 // A taller physical transition matches the lip and passes the relief audit.
 const quarters=2.2*Math.max(north*north,south*south)*street;
 const bowlRadius=Math.hypot(p.x+12,p.z-40);
 const bowl=-0.74*(1-smooth((bowlRadius-1)/4.9))+
  0.18*Math.max(0,1-Math.abs(bowlRadius-5.4)/0.55);
 const pyramid=0.66*Math.max(0,1-Math.abs(p.x+1)/2.5)*
  Math.max(0,1-Math.abs(p.z-40)/3.2);
 return Math.max(natural,deck+blend*(quarters+bowl+pyramid));
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
