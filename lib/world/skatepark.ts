import {terrainHeight,isWater,type Point} from "./model";

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
/**
 * The default first push points straight through the split redwood roll-in.
 * Stops describe an optional free-riding path, not rails or an autopilot.
 * Nothing moves the player after they begin skating.
 */
export const SKATE_GROVE_FLOW={
 approach:{x:3,z:40.8},
 splitEntry:{x:-6.6,z:40.8},
 hollow:{x:-11.6,z:40.7},
 farBank:{x:-16,z:40.9},
 southCarve:{x:-14.2,z:43.5},
 returnPocket:{x:-10.8,z:43.2},
 exit:{x:-6.5,z:41.25},
 runout:{x:2,z:42.1},
} as const;
export function skateGroveStartHeading():Point{
 const dx=SKATE_GROVE_FLOW.splitEntry.x-SKATE_GROVE_FLOW.approach.x;
 const dz=SKATE_GROVE_FLOW.splitEntry.z-SKATE_GROVE_FLOW.approach.z;
 const len=Math.hypot(dx,dz)||1;
 return {x:dx/len,z:dz/len};
}
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
/** Smooth, physically rideable redwood cross-section, independent of native
 * terrain. The C1 transition across the inside and bark exterior matches the
 * visual mesh; the shallow east split always remains available for drop-ins.
 * Exposing the bank profile makes its silhouette verifiable without relying
 * on procedural bark art or local hillside elevation. */
export function redwoodBowlBankRise(p:Point):number{
 const r=Math.hypot(p.x-REDWOOD_BOWL.center.x,p.z-REDWOOD_BOWL.center.z);
 const az=Math.atan2(p.z-REDWOOD_BOWL.center.z,p.x-REDWOOD_BOWL.center.x);
 const organic=1+.043*Math.sin(az*7+.5)+.021*Math.sin(az*11-1.1);
 // A wider carved floor lets the interior read as a hollow tree rather
 // than a raised platter. C1 smooth walls climb only outside radius 2.05.
 const bank=2.05*organic*smooth((r-2.05)/3.35)*
  (1-smooth((r-REDWOOD_BOWL.rimRadius)/1.36));
 const opening=smooth((p.x+9)/2.5)*(1-smooth(Math.abs(p.z-40.8)/2.15));
 return bank*(1-.66*opening);
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
 const bowl=redwoodBowlBankRise(p);
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

/** A forgiving bowl carve near the exposed western rim. Most turns remain
 * completely player-directed. At speed, an outward trajectory which would
 * exit the reserved skate meadow is gradually deflected onto the carved
 * tangent. This models banking assistance, not a path follower or teleport.
 * The player can still leave via the gentle east split at any speed. */
export function redwoodBowlCarveHeading(point:Point,heading:Point,speed:number,dt:number):Point{
 const r=Math.hypot(point.x-REDWOOD_BOWL.center.x,point.z-REDWOOD_BOWL.center.z);
 const mag=Math.hypot(heading.x,heading.z);
 if(!Number.isFinite(speed)||!Number.isFinite(dt)||speed<4.8||
  r<3.4||r>REDWOOD_BOWL.rimRadius+.05||mag<.01)return heading;
 const vx=(point.x-REDWOOD_BOWL.center.x)/r;
 const vz=(point.z-REDWOOD_BOWL.center.z)/r;
 const outward=(heading.x*vx+heading.z*vz)/mag;
 if(outward<.24)return heading;
 const angle=Math.atan2(vz,vx);
 const split=Math.atan2(Math.sin(angle-.15),Math.cos(angle-.15));
 if(Math.abs(split)<.50)return heading;
 const corridor={
  x:point.x+heading.x/mag*speed*1.05,
  z:point.z+heading.z/mag*speed*1.05,
 };
 if(insideSkatePark(corridor,-1.5)&&!isWater(corridor))return heading;
 const tangent={x:vz,z:-vx};
 const side=heading.x*tangent.x+heading.z*tangent.z>=0?1:-1;
 const strength=1-Math.exp(-Math.max(0,Math.min(.05,dt))*12);
 const x=heading.x/mag*(1-strength)+tangent.x*side*strength;
 const z=heading.z/mag*(1-strength)+tangent.z*side*strength;
 const len=Math.hypot(x,z)||1;
 return {x:x/len,z:z/len};
}

/** Launch only on an actual forward crossing, not on idle proximity or reverse. */
/** A fast outward rim crossing rewards a bowl carve without inventing a
 * second launch surface. The split eastern roll-in is deliberately omitted,
 * so approaching the bowl never pops the rider over its own entrance. */
export function redwoodBowlExitCrossing(previous:Point,current:Point,heading:Point,speed:number){
 if(!Number.isFinite(speed)||speed<5.1||
  !insideSkatePark(previous)||!insideSkatePark(current))return null;
 const center=REDWOOD_BOWL.center;
 const r0=Math.hypot(previous.x-center.x,previous.z-center.z);
 const r1=Math.hypot(current.x-center.x,current.z-center.z);
 const crossing=REDWOOD_BOWL.rimRadius-.18;
 if(r0>=crossing||r1<crossing||r1>crossing+1.15)return null;
 const vx=current.x-center.x,vz=current.z-center.z;
 const len=Math.hypot(vx,vz)||1;
 const outward=(heading.x*vx+heading.z*vz)/(Math.max(.001,Math.hypot(heading.x,heading.z))*len);
 if(outward<.72)return null;
 // The opening is not coping: preserve a low, accessible way in and out.
 const angle=Math.atan2(vz,vx);
 const split=Math.atan2(Math.sin(angle-.15),Math.cos(angle-.15));
 if(Math.abs(split)<.43)return null;
 // Flight must have meadow to land on. The island coast is just beyond the
 // western bowl wall: an uncontrolled westward pop would throw casual riders
 // off the park, so never assist a launch into the water or outside the grove.
 // Keep this low enough for a quick board catch rather than a ski-sized jump.
 const impulse=Math.min(3.25,2.80+Math.max(0,speed-5.1)*.035);
 // Downhill terrain can prolong airtime well past the level-ground
 // parabola. Reserve the full 1.1-second runout, not just the ~0.4-second
 // vacuum flight estimate; the empirical browser trace reached >10u.
 const flightTime=Math.max(1.1,2*impulse/14+.55);
 const directionLength=Math.max(.001,Math.hypot(heading.x,heading.z));
 const touchdown={
  x:current.x+heading.x/directionLength*speed*flightTime,
  z:current.z+heading.z/directionLength*speed*flightTime,
 };
 if(!insideSkatePark(touchdown,-1.3)||isWater(touchdown))return null;
 return {id:"redwood-bowl-exit",impulse};
}
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
 return redwoodBowlExitCrossing(previous,current,heading,speed);
}
