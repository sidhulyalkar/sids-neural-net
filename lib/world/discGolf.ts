import type { Point } from "./model";

/** Independent, deterministic arcade disc-golf simulation.
 * No model imports: the world supplies terrain, water and simulation time.
 * Distances are fictional world units, not regulation PDGA measurements. */
export type DiscPoint = Point & { y:number };
export type DiscGolfPhase = "off"|"ready"|"flying"|"landed"|"water"|"holed";
export type DiscGolfHole = {
  id:string;name:string;par:number;tee:Point;target:Point;
  motion:"sway"|"figure-eight"|"orbit";radius:number;period:number;
};
export const DISC_GOLF_HOLES:readonly DiscGolfHole[]=[
  {id:"redwood-bend",name:"Redwood Bend",par:3,tee:{x:-6,z:10},
   target:{x:-18,z:26},motion:"sway",radius:2.3,period:12},
  {id:"scrub-crosswind",name:"Scrub Crosswind",par:3,tee:{x:11,z:27},
   target:{x:29,z:17},motion:"figure-eight",radius:2.8,period:14},
  {id:"desert-drifter",name:"Desert Drifter",par:3,tee:{x:29,z:-11},
   target:{x:48,z:-29},motion:"orbit",radius:2.6,period:16},
  {id:"coastal-gust",name:"Coastal Gust",par:3,tee:{x:-22,z:5},
   target:{x:-29,z:21},motion:"sway",radius:2.7,period:10},
];
export const DISC_GOLF_VERSION="disc-golf-island-v1";
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const length=(p:Point)=>Math.hypot(p.x,p.z);
export type DiscWind=Point & {speed:number};
export function discGolfBasketPosition(hole:DiscGolfHole,t:number):Point{
 const u=Math.max(0,t)*2*Math.PI/hole.period;
 if(hole.motion==="orbit")return {x:hole.target.x+hole.radius*Math.cos(u),
   z:hole.target.z+hole.radius*Math.sin(u)};
 if(hole.motion==="figure-eight")return {x:hole.target.x+hole.radius*Math.sin(u),
   z:hole.target.z+hole.radius*.52*Math.sin(2*u)};
 return {x:hole.target.x+hole.radius*Math.sin(u),
   z:hole.target.z+.48*hole.radius*Math.sin(u+.9)};
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
 lastDistance:number;reason?:string;spin:number;
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
 const power=clamp(shot.power,0,100)/100;
 const accuracy=clamp(shot.accuracy,-1,1);
 const loft=clamp(shot.loft,6,42)*Math.PI/180;
 const hole=DISC_GOLF_HOLES[state.holeIndex];
 const basket=discGolfBasketPosition(hole,state.clock);
 const base=Math.atan2(basket.x-state.lie.x,basket.z-state.lie.z);
 const aim=base+clamp(shot.aimOffset,-55,55)*Math.PI/180+
   accuracy*.28;
 const speed=10+power*19;
 return {...state,phase:"flying",reason:undefined,
  disc:{...state.lie,y:ground(state.lie)+1.1},
  velocity:{x:Math.sin(aim)*Math.cos(loft)*speed,
    y:Math.sin(loft)*speed,z:Math.cos(aim)*Math.cos(loft)*speed},
  lockedWind:discGolfWind(state.holeIndex,state.clock),
  strokes:state.strokes+1,flightTime:0,lastDistance:0,spin:accuracy};
}
export function stepDiscGolf(state:DiscGolfState,dt:number,
 ground:DiscTerrain,isWater:(p:Point)=>boolean,seaSurface:number):DiscGolfState{
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
  const atBasket=Math.hypot(p.x-basket.x,p.z-basket.z)<1.12 &&
   next.y>cupY-.65&&next.y<cupY+.85&&horizontal<30;
  s.disc=next;
  if(atBasket){
   s.phase="holed";s.disc={...basket,y:cupY};
   s.lastDistance=Math.hypot(basket.x-state.lie.x,basket.z-state.lie.z);
   s.reason="Chains caught the disc";
   break;
  }
  if(isWater(p) && next.y<=seaSurface+.09){
   // User-requested water redo: do not count this throw, preserve last lie.
   s.phase="water";s.strokes=Math.max(0,s.strokes-1);s.waterRedos+=1;
   s.disc={...state.lie,y:ground(state.lie)+.18};
   s.reason="Water shot: free redo from last lie";
   break;
  }
  if(next.y<=ground(p)+.16 && s.flightTime>.12){
   s.phase="landed";s.disc={x:p.x,z:p.z,y:ground(p)+.16};
   s.lie={x:p.x,z:p.z};
   s.lastDistance=Math.hypot(p.x-state.lie.x,p.z-state.lie.z);
   s.reason="Disc landed. Shoot from the light marker.";
   break;
  }
  if(s.flightTime>=10 || Math.abs(p.x)>93 || Math.abs(p.z)>95 || p.z>57){
   s.phase="water";s.waterRedos+=1;s.strokes=Math.max(0,s.strokes-1);
   s.disc={...state.lie,y:ground(state.lie)+.18};
   s.reason="Out of bounds: free redo";
  }
 }
 return s;
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
