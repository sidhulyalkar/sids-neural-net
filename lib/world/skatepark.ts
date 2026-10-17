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
export const REDWOOD_BOWL={
 center:{x:-12,z:40},rimRadius:5.65,barkRadius:6.85,
 floorRadius:2.12,bankHeight:2.62,
 // Authoritative bank remains C1; exterior root/fluting art is decorative.
} as const;
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
/** Reference-inspired woodland features. Open split log and solid-backed bridge
 * deliberately use a single heightfield: no invisible tunnel/overpass collider. */
export const GROVE_LOG={center:{x:-11,z:30.7},halfLength:5.35,halfWidth:2.12} as const;
/** Ride-through giant sequoia: the existing open log remains the ONLY wheel
 * support. Its shell is hollow, with open ends and no invisible roof collider.
 * The inner crown clears the standing avatar while bark stays outside the lane. */
export const GROVE_TUNNEL={
 center:GROVE_LOG.center,halfLength:GROVE_LOG.halfLength,
 // A broad elliptical bore, gently tapered like a true fallen tree.
 innerRadius:2.85,outerRadius:3.32,
 innerHalfWidth:2.61,outerHalfWidth:3.09,
 archCenterLift:1.53,archExtent:2.12,
 // Limit old-growth taper so the northernmost inner wall remains over
 // actual authored skate terrain (the meadow begins at z=28).
 taper:.02,
 // Central polished floor is clear; exterior rings never cap the entrances.
 clearFloorHalfWidth:1.36,
} as const;
/** Vertical timber loop is NOT a heightfield: a single-valued ground profile
 * cannot represent both the bottom and the inverted crown. Its dedicated
 * rail traversal provides the 3D wheel/contact pose, then returns to roam. */
export const SKATE_LOOP={
 center:{x:-1.65,z:44.1},radius:3.75,radiusY:4.35,width:3.45,
 // In contrast to a closed ring, the descending side shifts west to a
 // separate landing seam. A sampled elliptical tread owns BOTH mesh and pose.
 exitOffset:2.15,leadLength:1.55,
 minEntrySpeed:8.4,entryHalfWidth:1.27,
 supportThickness:.24,
} as const;

/** Old-growth framing trees stay OUTSIDE the rideable meadow and use the
 * World tree renderer's same visible trunk + navigation obstacle contract.
 * Water positions are skipped by the caller. No decorative phantom trunks. */
export const SKATE_GROVE_FRAME_TREES=[
 {x:-18.7,z:24.0,h:23,r:1.15},
 {x:-8.0,z:23.7,h:27,r:1.22},
 {x:-1.0,z:23.0,h:20,r:.95},
 {x:11.6,z:33.8,h:20,r:1.00},
 {x:12.6,z:45.1,h:24,r:1.12},
 {x:10.8,z:52.3,h:19,r:.90},
] as const;

export const GROVE_BRIDGE={center:{x:-10,z:49},halfLength:4.2,halfWidth:1.05} as const;
export const GROVE_STONES=[
 {x:-10,z:47.4,rx:2.0,rz:.72,height:.82},
 {x:-10.8,z:50.7,rx:2.3,rz:.70,height:1.05},
 {x:-18.1,z:32.1,rx:.85,rz:1.1,height:.65},
] as const;
export function groveBridgeRise(p:Point):number{
 const u=Math.abs(p.x-GROVE_BRIDGE.center.x)/GROVE_BRIDGE.halfLength;
 const v=Math.abs(p.z-GROVE_BRIDGE.center.z);
 return 1.45*(1-smooth(u))*(1-smooth((v-GROVE_BRIDGE.halfWidth)/.7));
}
export function groveLogRise(p:Point):number{
 const u=Math.abs(p.x-GROVE_LOG.center.x)/GROVE_LOG.halfLength;
 const v=Math.abs(p.z-GROVE_LOG.center.z)/GROVE_LOG.halfWidth;
 // A wide, completely clear polished riding floor. Rise begins outside the
 // central bore, easing up the exposed wood shoulders without an artificial
 // wall, a canopy collider, or a wheel-catching seam at either end.
 const shoulder=smooth((v-.64)/.36)*(1-smooth((v-1)/.48));
 const end=1-smooth((u-.79)/.21);
 return 1.14*shoulder*end;
}
export function groveStoneRise(p:Point):number{
 return GROVE_STONES.reduce((height,rock)=>Math.max(height,rock.height*
  Math.max(0,1-Math.hypot((p.x-rock.x)/rock.rx,(p.z-rock.z)/rock.rz))),0);
}
export type SkateParkZone="redwood-bowl"|"timber-quarter"|"stump-pad"|"street"|"apron"|"sequoia-tunnel"|"timber-loop"|"canyon-flow";
export function skateParkZone(p:Point):SkateParkZone{
 if(insideCanyonFlow(p)&&!insideSkatePark(p))return "canyon-flow";
 if(Math.abs(p.x-SKATE_LOOP.center.x)<SKATE_LOOP.radius+0.55&&
  Math.abs(p.z-SKATE_LOOP.center.z)<SKATE_LOOP.width*.55+.18)
  return "timber-loop";
 if(Math.abs(p.x-GROVE_TUNNEL.center.x)<GROVE_TUNNEL.halfLength+.15&&
  Math.abs(p.z-GROVE_TUNNEL.center.z)<GROVE_LOG.halfWidth*.92)
  return "sequoia-tunnel";
 if(Math.hypot(p.x-REDWOOD_BOWL.center.x,p.z-REDWOOD_BOWL.center.z)<REDWOOD_BOWL.rimRadius+.85)
  return "redwood-bowl";
 if(STUMP_PADS.some(pad=>Math.hypot(p.x-pad.center.x,p.z-pad.center.z)<pad.radius+.12))
  return "stump-pad";
 if(p.x>=-2&&(p.z<34.4||p.z>45.6))return "timber-quarter";
 if(Math.abs(p.x+1)<3.4&&Math.abs(p.z-40)<4)return "street";
 return "apron";
}
/** The underused dry meadow between the forest skatepark and Moss Canyon
 * becomes an eastern flow connector, not a second square platform. Its support,
 * visuals and entrance all share this one smooth, bounded rise function. */
export const CANYON_FLOW={
 startX:7.4,endX:25.6,centerZ:39.4,halfWidth:4.5,
 rollers:[{x:11.1,height:.37},{x:15.6,height:.51},{x:19.4,height:.43}],
 hip:{x:22.4,z:40.2,width:1.6,impulse:2.45},
} as const;
export function insideCanyonFlow(p:Point){
 return p.x>=CANYON_FLOW.startX&&p.x<=CANYON_FLOW.endX&&
  Math.abs(p.z-CANYON_FLOW.centerZ)<=CANYON_FLOW.halfWidth&&!isWater(p);
}
export function canyonFlowRise(p:Point):number{
 if(!insideCanyonFlow(p))return 0;
 const {startX,endX,halfWidth,centerZ}=CANYON_FLOW;
 const along=smooth((p.x-startX)/2.8)*(1-smooth((p.x-(endX-2.4))/2.4));
 const across=1-smooth((Math.abs(p.z-centerZ)-1.4)/(halfWidth-1.4));
 const rollers=CANYON_FLOW.rollers.reduce((v,r)=>
  v+r.height*Math.exp(-((p.x-r.x)/1.27)**2),0);
 const hipX=smooth((p.x-19.9)/2.0)*(1-smooth((p.x-22.6)/2.25));
 const hipZ=1-smooth(Math.abs(p.z-CANYON_FLOW.hip.z)/2);
 // Connected low humps and one diagonal transfer bank. No abrupt jumps in Y
 // and no invisible geometry above the single-valued natural terrain support.
 return along*across*(rollers+hipX*hipZ*.48);
}
export const CANYON_MANUAL_PADS=[
 {id:"canyon-moss-pad",center:{x:11.6,z:42.0},radius:1.02,lift:.19},
 {id:"canyon-bark-pad",center:{x:18.1,z:35.9},radius:.93,lift:.16},
] as const;
function canyonPadRise(p:Point){
 return CANYON_MANUAL_PADS.reduce((value,pad)=>{
  const r=Math.hypot(p.x-pad.center.x,p.z-pad.center.z);
  return value+pad.lift*(1-smooth((r-pad.radius*.35)/(pad.radius*.65)));
 },0);
}

/** Smooth, physically rideable redwood cross-section, independent of native
 * terrain. The C1 transition across the inside and bark exterior matches the
 * visual mesh; the shallow east split always remains available for drop-ins.
 * Exposing the bank profile makes its silhouette verifiable without relying
 * on procedural bark art or local hillside elevation. */
export function redwoodBowlBankRise(p:Point):number{
 const r=Math.hypot(p.x-REDWOOD_BOWL.center.x,p.z-REDWOOD_BOWL.center.z);
 const az=Math.atan2(p.z-REDWOOD_BOWL.center.z,p.x-REDWOOD_BOWL.center.x);
 const organic=1+.035*Math.sin(az*7+.5)+.018*Math.sin(az*11-1.1);
 // Deeper and wider than v1: polished stump floor, tall carved banking and
 // soft external roots. The actual wheel support stays a single C1 profile.
 const bank=REDWOOD_BOWL.bankHeight*organic*
  smooth((r-REDWOOD_BOWL.floorRadius)/
    (REDWOOD_BOWL.rimRadius-REDWOOD_BOWL.floorRadius))*
  (1-smooth((r-REDWOOD_BOWL.rimRadius)/1.38));
 const opening=smooth((p.x+9)/2.5)*(1-smooth(Math.abs(p.z-40.8)/2.15));
 return bank*(1-.66*opening);
}

export function skateParkSurface(p:Point):number|null {
 if(!insideSkatePark(p)){
  return insideCanyonFlow(p)?
   terrainHeight(p.x,p.z)+canyonFlowRise(p)+canyonPadRise(p):null;
 }
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
 return Math.max(natural,deck+blend*(quarters+bowl+pyramid+stump+groveBridgeRise(p)+groveLogRise(p)+groveStoneRise(p)));
}
export type SkateRail={
 id:string;a:Point;b:Point;role:"sport";radius:number;lift:number;
 liftEnd?:number;chainId?:string;segment?:number;
};
type RailChain={
 id:string;points:readonly Point[];heights:readonly number[];
 radius:number;wood?:boolean;
};
/** Authored paths. Each vertex is shared by both adjacent segments.
 * The connected grind system can roll through the elbows without a fresh
 * Space press, and each wooden segment is drawn at its own physical Y. */
export const CANYON_RAIL_CHAINS:readonly RailChain[]=[
 {id:"root-sweep",points:[
  {x:-8.4,z:35.0},{x:-7.4,z:35.8},{x:-6.1,z:36.45},
  {x:-4.8,z:36.65}],heights:[.48,.52,.56,.58],radius:.102,wood:true},
 {id:"timber-switchback",points:[
  {x:2.65,z:34.2},{x:3.9,z:35.0},{x:5.2,z:34.55},
  {x:6.75,z:35.55}],heights:[.48,.66,.66,.52],radius:.074},
 {id:"canyon-snake",points:[
  {x:9.2,z:38.6},{x:11.4,z:37.65},{x:13.25,z:38.75},
  {x:15.2,z:37.8},{x:17.1,z:38.65}],heights:[.52,.62,.67,.61,.54],radius:.081},
 {id:"down-flat-down",points:[
  {x:14.0,z:42.2},{x:16.0,z:42.2},{x:17.35,z:41.7},
  {x:19.6,z:41.8}],heights:[.87,.63,.63,.36],radius:.078},
 {id:"canyon-root-curved",points:[
  {x:20.2,z:36.8},{x:21.5,z:37.30},
  {x:22.9,z:37.42},{x:24.0,z:37.00}],
  heights:[.50,.54,.55,.47],radius:.115,wood:true},
] as const;
export const SKATE_PARK_RAILS:readonly SkateRail[]=[
 {id:"park-flat-bar",a:{x:5,z:36},b:{x:5,z:44},role:"sport",radius:.075,lift:.54},
 {id:"park-down-rail",a:{x:-2,z:34.3},b:{x:0,z:38.2},role:"sport",radius:.08,lift:.52},
 {id:"park-bowl-coping",a:{x:-17,z:39},b:{x:-17,z:43},role:"sport",radius:.065,lift:.35},
 ...CANYON_RAIL_CHAINS.flatMap(chain=>chain.points.slice(0,-1).map((a,index)=>({
  id:chain.id+"-"+index,a,b:chain.points[index+1],role:"sport" as const,
  radius:chain.radius,lift:chain.heights[index],liftEnd:chain.heights[index+1],
  chainId:chain.id,segment:index,
 }))),
];
export function railLiftAt(rail:SkateRail,t:number){
 return rail.lift+((rail.liftEnd??rail.lift)-rail.lift)*Math.max(0,Math.min(1,t));
}
/** Travel across shared vertices in either direction, preserving distance
 * traveled even if a single frame passes more than one short rail segment. */
export function advanceRailChain(
 rail:SkateRail,t:number,direction:number,meters:number,
):{rail:SkateRail;t:number;covered:number;finished:boolean}{
 if(!rail.chainId||rail.segment===undefined)
  return {rail,t,covered:0,finished:true};
 let current=rail,fraction=Math.max(0,Math.min(1,t));
 let remaining=Math.max(0,meters),covered=0;
 const sign=direction>=0?1:-1;
 for(let hop=0;hop<24;hop++){
  const length=Math.hypot(current.b.x-current.a.x,current.b.z-current.a.z);
  const capacity=(sign>0?1-fraction:fraction)*length;
  const moved=Math.min(capacity,remaining);
  covered+=moved;remaining-=moved;
  fraction=Math.max(0,Math.min(1,fraction+sign*moved/Math.max(length,1e-6)));
  if(remaining<=1e-7)return {rail:current,t:fraction,covered,finished:false};
  const adjacent=SKATE_PARK_RAILS.find(candidate=>
   candidate.chainId===current.chainId&&candidate.segment===current.segment!+sign);
  if(!adjacent)return {rail:current,t:fraction,covered,finished:true};
  current=adjacent;fraction=sign>0?0:1;
 }
 return {rail:current,t:fraction,covered,finished:true};
}

export const SKATE_PARK_LIPS=[
 {id:"park-north-quarter",point:{x:2,z:30.9},heading:{x:0,z:-1},halfWidth:5.7,impulse:5.6},
 {id:"park-south-quarter",point:{x:2,z:49.1},heading:{x:0,z:1},halfWidth:5.7,impulse:5.6},
 {id:"canyon-wood-hip",point:{x:22.4,z:40.2},heading:{x:1,z:0},
  halfWidth:1.6,impulse:2.65},
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
