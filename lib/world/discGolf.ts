import type { Point } from "./model";

/** Independent, deterministic arcade disc-golf simulation.
 * No model imports: the world supplies terrain, water and simulation time.
 * Distances are fictional world units, not regulation PDGA measurements. */
export type DiscPoint = Point & { y:number };
export type DiscGolfPhase = "off"|"ready"|"flying"|"landed"|"water"|"holed";
export type DiscGolfSwingStage = "idle"|"power"|"accuracy"|"released";
export type DiscGolfGate={point:Point;radius:number};
/** Gates are *mandatory*, pass in order, and are credited by the actual
 * swept flight crossing. They are not checkpoints awarded for proximity. */
export type DiscGolfHole={
 id:string;name:string;par:number;tee:Point;target:Point;
 gates:readonly DiscGolfGate[];
};
// Independent tees let courses span multiple biomes without placing the next
// launch in a prior basket, tree trunk, steep grade, or cave mouth.
export const DISC_GOLF_HOLES:readonly DiscGolfHole[]=[
 {id:"redwood-bend",name:"Opening drive",par:4,tee:{x:35,z:-12},
  gates:[{point:{x:43,z:17},radius:8}],target:{x:41,z:49}},
 {id:"scrub-crosswind",name:"Shore to mountain backside",par:6,
  tee:{x:49,z:30},
  gates:[
   {point:{x:45,z:-9},radius:9},
   {point:{x:34,z:-42},radius:9},
   {point:{x:26,z:-69},radius:9},
  ],target:{x:26,z:-87}},
 {id:"desert-drifter",name:"High traverse",par:5,tee:{x:46,z:-4},
  gates:[{point:{x:40,z:-32},radius:8},{point:{x:27,z:-59},radius:8}],
  target:{x:8,z:-75}},
 {id:"coastal-gust",name:"Downhill transfer",par:5,tee:{x:9,z:-60},
  gates:[{point:{x:-15,z:-47},radius:9},{point:{x:-27,z:-21},radius:9}],
  target:{x:-21,z:17}},
 {id:"redwood-needles",name:"Western return",par:5,tee:{x:-24,z:38},
  gates:[{point:{x:-16,z:9},radius:8},{point:{x:-7,z:-31},radius:8}],
  target:{x:-23,z:-47}},
 {id:"fern-falls",name:"Forest crossing",par:5,tee:{x:-24,z:-5},
  gates:[{point:{x:-6,z:15},radius:8},{point:{x:18,z:30},radius:8}],
  target:{x:48,z:49}},
 {id:"granite-climb",name:"Backside descent",par:5,tee:{x:5,z:-62},
  gates:[{point:{x:24,z:-73},radius:8},{point:{x:36,z:-41},radius:8}],
  target:{x:44,z:-8}},
 {id:"joshua-chute",name:"Long desert lane",par:5,tee:{x:42,z:-67},
  gates:[{point:{x:45,z:-34},radius:9},{point:{x:39,z:-12},radius:9}],
  target:{x:23,z:15}},
 {id:"homeward-line",name:"Last long throw",par:5,tee:{x:46,z:49},
  gates:[{point:{x:19,z:19},radius:8},{point:{x:0,z:-3},radius:8}],
  target:{x:-24,z:-15}},
];
// Do not attach v1.6 scorecards to the longer v1.7 course and par system.
export const DISC_GOLF_VERSION="disc-golf-v1.7";

/** Capsule helpers shared by the seeded environment and course QA. */
function inCorridor(p:Point,from:Point,to:Point,radius:number){
 const dx=to.x-from.x,dz=to.z-from.z,den=dx*dx+dz*dz;
 const t=den>1e-8?Math.max(0,Math.min(1,
  ((p.x-from.x)*dx+(p.z-from.z)*dz)/den)):0;
 return Math.hypot(p.x-from.x-dx*t,p.z-from.z-dz*t)<radius;
}
/** Keep both playable ends and the first 11m of each throw clear.
 * Do not sterilize the whole route: mid-fairway obstacles stay interesting. */
export function discGolfCourseClearance(p:Point,extraRadius=0):boolean{
 for(let i=0;i<DISC_GOLF_HOLES.length;i++){
  const h=DISC_GOLF_HOLES[i];
  const nodes=[h.tee,...h.gates.map(g=>g.point),h.target];
  const first=nodes[1],last=nodes[nodes.length-2];
  const dirA=Math.hypot(first.x-h.tee.x,first.z-h.tee.z)||1;
  const dirB=Math.hypot(h.target.x-last.x,h.target.z-last.z)||1;
  const start={x:h.tee.x+(first.x-h.tee.x)*11/dirA,
   z:h.tee.z+(first.z-h.tee.z)*11/dirA};
  const approach={x:h.target.x-(h.target.x-last.x)*9/dirB,
   z:h.target.z-(h.target.z-last.z)*9/dirB};
  if(inCorridor(p,h.tee,start,3.3+extraRadius)||
     inCorridor(p,approach,h.target,3.1+extraRadius))
   return true;
  for(let j=0;j<h.gates.length;j++){
   const gate=h.gates[j],from=nodes[j],to=nodes[j+2];
   const a=Math.hypot(gate.point.x-from.x,gate.point.z-from.z)||1;
   const b=Math.hypot(to.x-gate.point.x,to.z-gate.point.z)||1;
   const entering={x:gate.point.x-(gate.point.x-from.x)*9/a,
    z:gate.point.z-(gate.point.z-from.z)*9/a};
   const leaving={x:gate.point.x+(to.x-gate.point.x)*7/b,
    z:gate.point.z+(to.z-gate.point.z)*7/b};
   if(inCorridor(p,entering,leaving,3+extraRadius))return true;
  }
 }
 return false;
}
// Hole 1 is the tutorial drive. Keep its entire flight lane easy to read.
export function discGolfOpeningClearance(p:Point,extraRadius=0):boolean{
 const h=DISC_GOLF_HOLES[0];
 return inCorridor(p,h.tee,h.target,3.5+extraRadius);
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
// Keep the existing time argument for render/simulation call sites; there is
// deliberately no animation or aiming uncertainty in basket position.
export function discGolfBasketPosition(hole:DiscGolfHole,_t:number):Point{
 return {...hole.target};
}
export function discGolfNextTarget(state:Pick<DiscGolfState,"holeIndex"|"gatesCleared">):Point{
 const h=DISC_GOLF_HOLES[state.holeIndex];
 return h.gates[state.gatesCleared]?.point??h.target;
}
export function discGolfRouteLength(hole:DiscGolfHole):number{
 const pts=[hole.tee,...hole.gates.map(g=>g.point),hole.target];
 return pts.slice(1).reduce((sum,p,i)=>sum+Math.hypot(
  p.x-pts[i].x,p.z-pts[i].z),0);
}
/** Swept crossing through an upright, wide portal. The signed plane faces
 * from the prior route marker to the gate. A correct crossing must move
 * forward and stay inside the visible width/vertical clearance. */
export function discGolfGateCrossing(from:DiscPoint,to:DiscPoint,
 hole:DiscGolfHole,index:number,ground:DiscTerrain):boolean{
 const gate=hole.gates[index];
 if(!gate)return false;
 const previous=index===0?hole.tee:hole.gates[index-1].point;
 const dirX=gate.point.x-previous.x,dirZ=gate.point.z-previous.z;
 const len=Math.hypot(dirX,dirZ)||1,nx=dirX/len,nz=dirZ/len;
 const before=(from.x-gate.point.x)*nx+(from.z-gate.point.z)*nz;
 const after=(to.x-gate.point.x)*nx+(to.z-gate.point.z)*nz;
 // A miss beyond the gate must be recoverable: flying back *through* the
 // arch also counts. Crossing the plane is mandatory, direction is not.
 if(before*after>0||Math.abs(after-before)<1e-6)return false;
 const t=Math.max(0,Math.min(1,-before/(after-before)));
 const x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
 const y=from.y+(to.y-from.y)*t,base=ground(gate.point);
 const cross=Math.abs((x-gate.point.x)*nz-(z-gate.point.z)*nx);
 return cross<=gate.radius&&y>=base+.35&&y<=base+12;
}
export type DiscWind=Point & {speed:number};
export function discGolfWind(index:number,t:number):DiscWind{
 // Slow predictable gust variation; locked at the moment of release.
 const phase=index*1.79+t*.19;
 const x=Math.sin(phase)*1.5+Math.cos(phase*.34)*.85;
 const z=Math.cos(phase*.7)*1.05+Math.sin(phase*.55)*.45;
 return {x,z,speed:Math.hypot(x,z)};
}
export type DiscShot={power:number;accuracy:number;loft:number;aimOffset:number};
export type DiscGolfState={
 phase:DiscGolfPhase;holeIndex:number;gatesCleared:number;lie:Point; disc:DiscPoint;
 velocity:{x:number;y:number;z:number};strokes:number;waterRedos:number;
 flightTime:number;clock:number;lockedWind:DiscWind;
 lastDistance:number;reason?:string;spin:number;resultAt?:number;
};
export type DiscTerrain=(p:Point)=>number;
export function startDiscGolf(index:number,ground:DiscTerrain,clock=0):DiscGolfState{
 const holeIndex=((index%DISC_GOLF_HOLES.length)+DISC_GOLF_HOLES.length)%DISC_GOLF_HOLES.length;
 const lie={...DISC_GOLF_HOLES[holeIndex].tee};
 return {phase:"ready",holeIndex,gatesCleared:0,lie,
  disc:{...lie,y:ground(lie)+.18},velocity:{x:0,y:0,z:0},
  strokes:0,waterRedos:0,flightTime:0,clock,lockedWind:discGolfWind(holeIndex,clock),
  lastDistance:0,spin:0};
}
export const idleDiscGolf=():DiscGolfState=>({
 phase:"off",holeIndex:0,gatesCleared:0,lie:{x:0,z:0},disc:{x:0,y:0,z:0},
 velocity:{x:0,y:0,z:0},strokes:0,waterRedos:0,flightTime:0,clock:0,
 lockedWind:{x:0,z:0,speed:0},lastDistance:0,spin:0,
});
export function discGolfThrow(state:DiscGolfState,shot:DiscShot,ground:DiscTerrain):DiscGolfState{
 if(!["ready","landed","water"].includes(state.phase))return state;
 if(![shot.power,shot.accuracy,shot.loft,shot.aimOffset].every(Number.isFinite))return state;
 const power=clamp(shot.power,0,100)/100;
 const accuracy=clamp(shot.accuracy,-1,1);
 const loft=clamp(shot.loft,6,42)*Math.PI/180;
 const hole=DISC_GOLF_HOLES[state.holeIndex];
 const aimPoint=discGolfNextTarget(state);
 const base=Math.atan2(aimPoint.x-state.lie.x,aimPoint.z-state.lie.z);
 const aim=base+clamp(shot.aimOffset,-55,55)*Math.PI/180+
   accuracy*.28;
 // A low-end putt must be possible: zero power is no longer a full drive.
 const speed=2.3+power*26.7;
 return {...state,phase:"flying",reason:undefined,
  disc:{...state.lie,y:ground(state.lie)+1.1},
  velocity:{x:Math.sin(aim)*Math.cos(loft)*speed,
    y:Math.sin(loft)*speed,z:Math.cos(aim)*Math.cos(loft)*speed},
  lockedWind:discGolfWind(state.holeIndex,state.clock),
  strokes:state.strokes+1,flightTime:0,lastDistance:0,spin:accuracy,resultAt:undefined};
}
/** Cylindrical trunk intersection swept from previous to next disc center.
 * A small radius allowance represents the disc itself, not imaginary foliage. */
export type DiscGolfObstacle=Point & {radius:number;height?:number};
export function discGolfTreeContact(from:DiscPoint,to:DiscPoint,
 obstacle:DiscGolfObstacle,ground:DiscTerrain):DiscPoint|null{
 const r=Math.max(0,obstacle.radius)+.24;
 const dx=to.x-from.x,dz=to.z-from.z;
 const ox=from.x-obstacle.x,oz=from.z-obstacle.z;
 const aa=dx*dx+dz*dz;
 if(aa<1e-12)return null;
 const bb=2*(ox*dx+oz*dz),cc=ox*ox+oz*oz-r*r;
 const disc=bb*bb-4*aa*cc;
 if(disc<0)return null;
 const t=Math.max(0,(-bb-Math.sqrt(disc))/(2*aa));
 if(t>1)return null;
 const y=from.y+(to.y-from.y)*t,base=ground(obstacle);
 if(y<base+.17||y>base+(obstacle.height??9))return null;
 return {x:from.x+dx*t,y,z:from.z+dz*t};
}
export function stepDiscGolf(state:DiscGolfState,dt:number,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number,
 obstacles:readonly DiscGolfObstacle[]=[]):DiscGolfState{
 if(!Number.isFinite(dt)||dt<0)return state;
 if(state.phase!=="flying")return {...state,clock:state.clock+Math.min(dt,.12)};
 let s={...state,velocity:{...state.velocity},disc:{...state.disc}};
 let left=Math.min(dt,.12);
 while(left>1e-7&&s.phase==="flying"){
  const d=Math.min(.0125,left);left-=d;s.clock+=d;s.flightTime+=d;
  const old={...s.disc};
  // Easy-to-read stylized glide: drag, modest lift and crosswind.
  const horizontal=Math.hypot(s.velocity.x,s.velocity.z);
  const relativeX=s.lockedWind.x-s.velocity.x;
  const relativeZ=s.lockedWind.z-s.velocity.z;
  const drag=.020;
  s.velocity.x+=relativeX*drag*d;
  s.velocity.z+=relativeZ*drag*d;
  s.velocity.y+=(-10.8+Math.min(2.3,horizontal*.045))*d;
  const next={x:old.x+s.velocity.x*d,y:old.y+s.velocity.y*d,
   z:old.z+s.velocity.z*d};
  const p={x:next.x,z:next.z};
  const basket=discGolfBasketPosition(DISC_GOLF_HOLES[s.holeIndex],s.clock);
  const cupY=ground(basket)+1.35;
  // Swept capture avoids a disc slipping through chains between updates.
  const vx=next.x-old.x,vz=next.z-old.z;
  const u=clamp(((basket.x-old.x)*vx+(basket.z-old.z)*vz)/
    Math.max(1e-8,vx*vx+vz*vz),0,1);
  const nearX=old.x+vx*u,nearZ=old.z+vz*u;
  const nearY=old.y+(next.y-old.y)*u;
  const atBasket=Math.hypot(nearX-basket.x,nearZ-basket.z)<1.05 &&
   nearY>cupY-.66&&nearY<cupY+.80&&horizontal<31;
  s.disc=next;
  // Gate progress is earned by crossing the actual open arch, never merely
  // approaching it. One throw can pass multiple gates in sequence.
  while(s.gatesCleared<DISC_GOLF_HOLES[s.holeIndex].gates.length &&
    discGolfGateCrossing(old,next,DISC_GOLF_HOLES[s.holeIndex],
      s.gatesCleared,ground))s.gatesCleared++;
  if(atBasket && s.gatesCleared===DISC_GOLF_HOLES[s.holeIndex].gates.length){
   s.phase="holed";s.disc={...basket,y:cupY};
   s.lastDistance=Math.hypot(basket.x-state.lie.x,basket.z-state.lie.z);
   s.reason="Chains caught the disc";s.resultAt=s.clock;
   break;
  }
  if(isWater(p) && next.y<=seaSurface+.09){
   // User-requested water redo: do not count this throw, preserve last lie.
   s.phase="water";s.strokes=Math.max(0,s.strokes-1);s.waterRedos+=1;
   s.gatesCleared=state.gatesCleared;
   s.disc={...state.lie,y:ground(state.lie)+.18};
   s.reason="Water shot: free redo from last lie";s.resultAt=s.clock;
   break;
  }
  // Tree trunks are actual swept obstacles. A collision leaves the disc
  // on real terrain and costs the current stroke, not a free water redo.
  let trunkContact:DiscPoint|null=null;
  let trunkObstacle:DiscGolfObstacle|null=null;
  if(s.flightTime>.10){
   for(const trunk of obstacles){
    if(Math.abs(p.x-trunk.x)>trunk.radius+1.3 &&
       Math.abs(old.x-trunk.x)>trunk.radius+1.3)continue;
    if(Math.abs(p.z-trunk.z)>trunk.radius+1.3 &&
       Math.abs(old.z-trunk.z)>trunk.radius+1.3)continue;
    const hit=discGolfTreeContact(old,next,trunk,ground);
    if(hit){trunkContact=hit;trunkObstacle=trunk;break;}
   }
  }
  if(trunkContact && trunkObstacle){
   // The disc collides at its own small radius, but the explorer occupies
   // a larger walking capsule (obstacle.radius + 0.45). Place the next
   // throwing lie just outside that capsule with modest clearance.
   const vx=trunkContact.x-trunkObstacle.x;
   const vz=trunkContact.z-trunkObstacle.z;
   const len=Math.hypot(vx,vz)||1;
   const away=trunkObstacle.radius+.62;
   const lie={x:trunkObstacle.x+vx/len*away,z:trunkObstacle.z+vz/len*away};
   s.phase="landed";s.lie=lie;s.disc={...lie,y:ground(lie)+.16};
   s.lastDistance=Math.hypot(lie.x-state.lie.x,lie.z-state.lie.z);
   s.reason="Tree contact. The next shot starts here.";
   s.resultAt=s.clock;
   break;
  }
  // The island's analytic hillside height is not the sea surface.
  // Never turn open water into a valid lie just because terrainHeight is high.
  if(!isWater(p) && next.y<=ground(p)+.16 && s.flightTime>.12){
   s.phase="landed";s.disc={x:p.x,z:p.z,y:ground(p)+.16};
   s.lie={x:p.x,z:p.z};
   s.lastDistance=Math.hypot(p.x-state.lie.x,p.z-state.lie.z);
   const near=Math.hypot(p.x-basket.x,p.z-basket.z);
   s.reason=near<4?"Short putt: tap Space for suggested power.":
     "Disc landed. Shoot from the light marker.";s.resultAt=s.clock;
   break;
  }
  if(s.flightTime>=10 || Math.abs(p.x)>93 || Math.abs(p.z)>95 || p.z>57){
   s.phase="water";s.waterRedos+=1;s.strokes=Math.max(0,s.strokes-1);
   s.gatesCleared=state.gatesCleared;
   s.disc={...state.lie,y:ground(state.lie)+.18};
   s.reason="Out of bounds: free redo";s.resultAt=s.clock;
  }
 }
 return s;
}
/** Approximate, ideal-center-release projection, sampled by the same
 * flight engine as gameplay. Moving target and current wind can change
 * between preview and the actual release. No guaranteed landing claim. */
export type DiscGolfPreview={points:readonly DiscPoint[];
  outcome:DiscGolfPhase;end:DiscPoint;gatesCleared:number};
export function traceDiscGolfShot(state:DiscGolfState,shot:DiscShot,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number,
 obstacles:readonly DiscGolfObstacle[]=[]):DiscGolfPreview{
 if(!["ready","landed","water"].includes(state.phase))
   return {points:[],outcome:state.phase,end:state.disc,gatesCleared:state.gatesCleared};
 let preview=discGolfThrow(state,shot,ground);
 const points:DiscPoint[]=[{...preview.disc}];
 for(let i=0;i<90&&preview.phase==="flying";i++){
   preview=stepDiscGolf(preview,.10,ground,isWater,seaSurface,obstacles);
   // A water redo teleports the game disc to its previous lie. The preview
   // must never draw a fake line connecting that reset to the splash point.
   if(preview.phase==="water")break;
   points.push({...preview.disc});
 }
 return {points,outcome:preview.phase,end:{...preview.disc},gatesCleared:preview.gatesCleared};
}

/** Deterministic suggestion. Search reachable shots with the same physics
 * as the flight preview; never claim that trees or release timing are solved.
 * A tap of Space accepts this, while holding Space overrides it. */
export function recommendDiscGolfPower(
 state:DiscGolfState,loft:number,aimOffset:number,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number,
 obstacles:readonly DiscGolfObstacle[]=[]):number{
 if(!["ready","landed","water"].includes(state.phase))return 0;
 const basket=discGolfNextTarget(state);
 const dx=basket.x-state.lie.x,dz=basket.z-state.lie.z;
 const remaining=Math.hypot(dx,dz);
 const fx=remaining>1e-8?dx/remaining:0;
 const fz=remaining>1e-8?dz/remaining:1;
 const putting=remaining<=9 && state.gatesCleared===DISC_GOLF_HOLES[state.holeIndex].gates.length;
 // A drive aims to reach an approachable green, not auto-sink every
 // hole from the tee. Near the chains the same helper becomes a true putt.
 const gatePending=state.gatesCleared<DISC_GOLF_HOLES[state.holeIndex].gates.length;
 const leave=putting?0:Math.min(7,Math.max(3.5,remaining*.17));
 const goal=gatePending?remaining+4:Math.max(0,remaining-leave);
 let best=55,bestScore=Infinity;
 for(let power=4;power<=100;power+=4){
  const trace=traceDiscGolfShot(state,{power,loft,aimOffset,accuracy:0},
   ground,isWater,seaSurface,obstacles);
  if(trace.outcome!=="landed"&&trace.outcome!=="holed")continue;
  if(putting&&trace.outcome==="holed")return power;
  const traveledX=trace.end.x-state.lie.x;
  const traveledZ=trace.end.z-state.lie.z;
  const along=traveledX*fx+traveledZ*fz;
  const lateral=Math.abs(traveledX*fz-traveledZ*fx);
  const overshoot=Math.max(0,along-remaining);
  // Crossing the gate is always preferable to a visually close miss.
  const crossed=trace.gatesCleared>state.gatesCleared;
  const score=Math.abs(along-goal)+lateral*.7+
   (gatePending?Math.max(0,along-remaining-14)*.4:overshoot*1.5)+
   (gatePending&&!crossed?90:0)+
   (!putting&&trace.outcome==="holed"?12:0)+power*.001;
  if(score<bestScore){bestScore=score;best=power;}
 }
 return best;
}

/** Noninteractive camera introduction for a fixed chain basket.
 * The course shows the basket, then pulls back along the fairway to the
 * player. Positions are derived from world time, so tab pauses cannot drift.
 * Returning "complete" preserves the renderer's exact ordinary camera pose.
 */
export const DISC_GOLF_INTRO_HOLD=0.7;
export const DISC_GOLF_INTRO_PULLBACK=2.65;
export type DiscGolfIntroStage="basket"|"pullback"|"complete";
export type DiscGolfIntroPose={
 stage:DiscGolfIntroStage; camera:DiscPoint; look:DiscPoint;
};
export function discGolfIntroPose(
 tee:Point,basket:Point,followCamera:DiscPoint,followLook:DiscPoint,
 elapsedSeconds:number,ground:DiscTerrain,reducedMotion=false,
):DiscGolfIntroPose{
 const distance=Math.hypot(basket.x-tee.x,basket.z-tee.z)||1;
 const ux=(basket.x-tee.x)/distance,uz=(basket.z-tee.z)/distance;
 const close={x:basket.x-ux*8.5,z:basket.z-uz*8.5};
 const camera:DiscPoint={...close,
  y:Math.max(ground(close)+5.2,ground(basket)+5.8)};
 const look:DiscPoint={...basket,y:ground(basket)+1.5};
 if(elapsedSeconds<DISC_GOLF_INTRO_HOLD)
  return {stage:"basket",camera,look};
 // Reduced-motion visitors still see where the target is, but there is
 // no moving flyover. Return via a single camera cut after the hold.
 if(reducedMotion||elapsedSeconds>=DISC_GOLF_INTRO_HOLD+DISC_GOLF_INTRO_PULLBACK)
  return {stage:"complete",camera:{...followCamera},look:{...followLook}};
 const t=clamp((elapsedSeconds-DISC_GOLF_INTRO_HOLD)/DISC_GOLF_INTRO_PULLBACK,0,1);
 const eased=t*t*(3-2*t);
 const x=camera.x+(followCamera.x-camera.x)*eased;
 const z=camera.z+(followCamera.z-camera.z)*eased;
 // A small rising arc reveals the fairway and keeps the camera above hills.
 const height=camera.y+(followCamera.y-camera.y)*eased+
  Math.sin(Math.PI*eased)*Math.min(14,distance*.16);
 return {
  stage:"pullback",
  camera:{x,z,y:Math.max(height,ground({x,z})+3.5+(1-eased))},
  look:{
   x:look.x+(followLook.x-look.x)*eased,
   y:look.y+(followLook.y-look.y)*eased,
   z:look.z+(followLook.z-look.z)*eased,
  },
 };
}

/** Stable 3rd-person, slightly elevated view. In particular, short putts
 * must not collapse to a close-up of the character or chain basket.
 * The look-ahead is capped so both disc and chains stay in frame. */
export function discGolfThrowCameraPose(lie:Point,basket:Point,playerY:number){
 const distance=Math.hypot(basket.x-lie.x,basket.z-lie.z);
 const inv=1/Math.max(.001,distance);
 // An exactly coincident missed lie must not collapse the camera to overhead.
 const fx=distance<.001?0:(basket.x-lie.x)*inv;
 const fz=distance<.001?1:(basket.z-lie.z)*inv;
 const putting=distance<=10;
 const boom=putting?21:19.5;
 const rise=putting?15:13;
 const lookAhead=putting?clamp(distance*.45,0.8,4):5.5;
 const side=2.25;
 return {
  putting,
  camera:{x:lie.x-fx*boom+fz*side,y:playerY+rise,
   z:lie.z-fz*boom-fx*side},
  look:{x:lie.x+fx*lookAhead,y:playerY+1.85,
   z:lie.z+fz*lookAhead},
 };
}

/** A single elastic backswing meter, no second accuracy minigame.
 * Tapping Space always uses the recommended shot. Holding lets players
 * deliberately add/subtract strength by releasing near the center marker.
 * At the tap/hold boundary the sampled power is continuous. */
export const DISC_GOLF_TAP_WINDOW_MS=240;
export const DISC_GOLF_SWING_CYCLE_MS=1720;
export function discGolfPullback(elapsedMs:number,suggested:number){
 const center=clamp(Math.round(suggested),4,100);
 const ms=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0);
 const manual=ms>DISC_GOLF_TAP_WINDOW_MS;
 const cycle=manual?(ms-DISC_GOLF_TAP_WINDOW_MS)/DISC_GOLF_SWING_CYCLE_MS:0;
 const deviation=manual?32*Math.sin(cycle*2*Math.PI):0;
 const power=clamp(Math.round(center+deviation),4,100);
 const difference=Math.abs(power-center);
 return {power,manual,quality:difference<=6?"clean":difference<=17?"controlled":"strong",
  // Windup gives the arm real preparation even before the meter changes.
  windup:manual?clamp(.42+.53*Math.abs(Math.sin(cycle*Math.PI)),0,1):
   clamp(ms/DISC_GOLF_TAP_WINDOW_MS*.42,0,.42),
 };
}

export function discGolfRemaining(state:DiscGolfState):number{
 const hole=DISC_GOLF_HOLES[state.holeIndex];
 const p=discGolfNextTarget(state);
 return Math.hypot(state.lie.x-p.x,state.lie.z-p.z);
}
export function discGolfScoreName(strokes:number,par:number):string{
 const delta=strokes-par;
 if(strokes===1)return "Ace!";
 if(delta<=-2)return "Eagle";
 if(delta===-1)return "Birdie";
 if(delta===0)return "Par";
 return delta===1?"Bogey":`+${delta} over par`;
}
