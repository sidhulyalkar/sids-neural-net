import type { Point } from "./model";

/** Independent, deterministic arcade disc-golf simulation.
 * No model imports: the world supplies terrain, water and simulation time.
 * Distances are fictional world units, not regulation PDGA measurements. */
export type DiscPoint = Point & { y:number };
export type DiscGolfPhase = "off"|"ready"|"flying"|"landed"|"water"|"holed";
export type DiscGolfSwingStage = "idle"|"power"|"accuracy"|"released";
export type DiscGolfHole = {
  id:string;name:string;par:number;tee:Point;target:Point;
};
// Fixed destinations form a linked cross-island route. The previous basket
// is the next tee, so the whole course reads as a journey, not target chasing.
export const DISC_GOLF_HOLES:readonly DiscGolfHole[]=[
  {id:"redwood-bend",name:"Redwood Traverse",par:4,tee:{x:-6,z:10},
   target:{x:42,z:42}},
  {id:"scrub-crosswind",name:"Scrub Crosswind",par:4,tee:{x:42,z:42},
   target:{x:43,z:-29}},
  {id:"desert-drifter",name:"Desert Ridge",par:4,tee:{x:43,z:-29},
   target:{x:0,z:-61}},
  {id:"coastal-gust",name:"Coastal Return",par:5,tee:{x:0,z:-61},
   target:{x:-25,z:15}},
];
export const DISC_GOLF_VERSION="disc-golf-island-v1.2";
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
// Keep the existing time argument for render/simulation call sites; there is
// deliberately no animation or aiming uncertainty in basket position.
export function discGolfBasketPosition(hole:DiscGolfHole,_t:number):Point{
 return {...hole.target};
}
export function discGolfWind(index:number,t:number):DiscWind{
 // Slow predictable gust variation; locked at the moment of release.
 const phase=index*1.79+t*.19;
 const x=Math.sin(phase)*1.5+Math.cos(phase*.34)*.85;
 const z=Math.cos(phase*.7)*1.05+Math.sin(phase*.55)*.45;
 return {x,z,speed:Math.hypot(x,z)};
}
export type DiscShot={power:number;accuracy:number;loft:number;aimOffset:number};
export type DiscGolfState={
 phase:DiscGolfPhase;holeIndex:number;lie:Point; disc:DiscPoint;
 velocity:{x:number;y:number;z:number};strokes:number;waterRedos:number;
 flightTime:number;clock:number;lockedWind:DiscWind;
 lastDistance:number;reason?:string;spin:number;resultAt?:number;
};
export type DiscTerrain=(p:Point)=>number;
export function startDiscGolf(index:number,ground:DiscTerrain,clock=0):DiscGolfState{
 const holeIndex=((index%DISC_GOLF_HOLES.length)+DISC_GOLF_HOLES.length)%DISC_GOLF_HOLES.length;
 const lie={...DISC_GOLF_HOLES[holeIndex].tee};
 return {phase:"ready",holeIndex,lie,
  disc:{...lie,y:ground(lie)+.18},velocity:{x:0,y:0,z:0},
  strokes:0,waterRedos:0,flightTime:0,clock,lockedWind:discGolfWind(holeIndex,clock),
  lastDistance:0,spin:0};
}
export const idleDiscGolf=():DiscGolfState=>({
 phase:"off",holeIndex:0,lie:{x:0,z:0},disc:{x:0,y:0,z:0},
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
 const basket=discGolfBasketPosition(hole,state.clock);
 const base=Math.atan2(basket.x-state.lie.x,basket.z-state.lie.z);
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
  if(atBasket){
   s.phase="holed";s.disc={...basket,y:cupY};
   s.lastDistance=Math.hypot(basket.x-state.lie.x,basket.z-state.lie.z);
   s.reason="Chains caught the disc";s.resultAt=s.clock;
   break;
  }
  if(isWater(p) && next.y<=seaSurface+.09){
   // User-requested water redo: do not count this throw, preserve last lie.
   s.phase="water";s.strokes=Math.max(0,s.strokes-1);s.waterRedos+=1;
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
  outcome:DiscGolfPhase;end:DiscPoint};
export function traceDiscGolfShot(state:DiscGolfState,shot:DiscShot,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number,
 obstacles:readonly DiscGolfObstacle[]=[]):DiscGolfPreview{
 if(!["ready","landed","water"].includes(state.phase))
   return {points:[],outcome:state.phase,end:state.disc};
 let preview=discGolfThrow(state,shot,ground);
 const points:DiscPoint[]=[{...preview.disc}];
 for(let i=0;i<90&&preview.phase==="flying";i++){
   preview=stepDiscGolf(preview,.10,ground,isWater,seaSurface,obstacles);
   // A water redo teleports the game disc to its previous lie. The preview
   // must never draw a fake line connecting that reset to the splash point.
   if(preview.phase==="water")break;
   points.push({...preview.disc});
 }
 return {points,outcome:preview.phase,end:{...preview.disc}};
}

/** Deterministic suggestion. Search reachable shots with the same physics
 * as the flight preview; never claim that trees or release timing are solved.
 * A tap of Space accepts this, while holding Space overrides it. */
export function recommendDiscGolfPower(
 state:DiscGolfState,loft:number,aimOffset:number,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number,
 obstacles:readonly DiscGolfObstacle[]=[]):number{
 if(!["ready","landed","water"].includes(state.phase))return 0;
 const basket=discGolfBasketPosition(DISC_GOLF_HOLES[state.holeIndex],state.clock);
 let best=55,bestScore=Infinity;
 for(let power=4;power<=100;power+=4){
  const trace=traceDiscGolfShot(state,{power,loft,aimOffset,accuracy:0},
   ground,isWater,seaSurface,obstacles);
  if(trace.outcome==="holed")return power;
  if(trace.outcome!=="landed")continue;
  const d=Math.hypot(trace.end.x-basket.x,trace.end.z-basket.z);
  // Favor useful progress, avoid over-strong putts when distances are equal.
  const score=d+power*.001;
  if(score<bestScore){bestScore=score;best=power;}
 }
 return best;
}

export function discGolfRemaining(state:DiscGolfState):number{
 const hole=DISC_GOLF_HOLES[state.holeIndex];
 const p=discGolfBasketPosition(hole,state.clock);
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
