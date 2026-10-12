/** Transparent time-attack competitors, not collidable AI or recordings.
 * Deterministic paths use the same ground-safe bypass route as the player.
 */
import {desertTrackGroundRoute,desertTrackFrame,DESERT_TRACK_LENGTH} from "./desertTrack";
import {JOSHUA_GATES,type TrialState} from "./trials";
import type {Point} from "./model";
export const JOSHUA_GHOSTS=[
 {id:"copper",name:"Copper",speed:10.2,lane:-.45},
 {id:"sage",name:"Sage",speed:11.6,lane:.45},
] as const;
const path=desertTrackGroundRoute(52);
const lengths=[0];
for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+
 Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
export const JOSHUA_GHOST_ROUTE_LENGTH=lengths[lengths.length-1];
export type GhostPose={point:Point;heading:number;fraction:number;done:boolean};
export function joshuaGhostPose(elapsedMs:number,ghost:typeof JOSHUA_GHOSTS[number]):GhostPose{
 const along=Math.max(0,Math.min(JOSHUA_GHOST_ROUTE_LENGTH,
  elapsedMs/1000*ghost.speed));
 let lo=0,hi=lengths.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(lengths[mid]<=along)lo=mid;else hi=mid;}
 const a=path[lo],b=path[Math.min(lo+1,path.length-1)];
 const segment=Math.max(.00001,lengths[Math.min(lo+1,lengths.length-1)]-lengths[lo]);
 const f=Math.min(1,(along-lengths[lo])/segment);
 const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;
 return {point:{x:a.x+dx*f+(-dz/n)*ghost.lane,
  z:a.z+dz*f+(dx/n)*ghost.lane},
  heading:Math.atan2(dx,dz),fraction:along/JOSHUA_GHOST_ROUTE_LENGTH,
  done:along>=JOSHUA_GHOST_ROUTE_LENGTH};
}
/** Gate credit remains authoritative. Fraction is display-only, never scoring. */
export function joshuaPlayerFraction(state:TrialState,player:Point):number{
 if(state.phase==="complete")return 1;
 if(state.phase==="armed"||state.phase==="idle")return 0;
 const previous=JOSHUA_GATES[Math.max(0,Math.min(
  state.nextGate-1,JOSHUA_GATES.length-1))].s;
 const next=state.nextGate>=JOSHUA_GATES.length?
  DESERT_TRACK_LENGTH:JOSHUA_GATES[state.nextGate].s;
 const position=desertTrackFrame(player).s;
 return Math.max(0,Math.min(1,
  Math.max(previous,Math.min(next,position))/DESERT_TRACK_LENGTH));
}
export function joshuaRacePlace(state:TrialState,player:Point):number{
 if(state.phase==="complete")return 1+JOSHUA_GHOSTS.filter(ghost=>
  state.elapsedMs>JOSHUA_GHOST_ROUTE_LENGTH/ghost.speed*1000).length;
 const progress=joshuaPlayerFraction(state,player);
 return 1+JOSHUA_GHOSTS.filter(ghost=>{
  const pose=joshuaGhostPose(state.elapsedMs,ghost);
  return pose.fraction>progress;
 }).length;
}
