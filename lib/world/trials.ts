import type {Point} from "./model";
import {
  DESERT_TRACK_LENGTH,DESERT_JUMPS,desertTrackSampleAt,
  desertTrackFrame,desertBypassClearance,
} from "./desertTrack";

/** Pure run scoring. No React state, timers or browser persistence here. */
export const JOSHUA_TRIAL = {
  id:"joshua-adventure-lap",
  version:"course-305-v2-ghost-boost",
  requiredMode:"bike",
  gateHalfWidth:3.1,
  checkpointCount:12,
} as const;
export type TrialPhase="idle"|"armed"|"running"|"complete"|"invalidated";
export type TrialGate={id:string;s:number;point:Point;forward:Point;halfWidth:number};
const dist=(p:Point,q:Point)=>Math.hypot(p.x-q.x,p.z-q.z);
const headingAt=(s:number):Point=>{
  const a=desertTrackSampleAt(s-.15),b=desertTrackSampleAt(s+.15);
  const length=dist(a,b)||1;return {x:(b.x-a.x)/length,z:(b.z-a.z)/length};
};
const spacing=DESERT_TRACK_LENGTH/JOSHUA_TRIAL.checkpointCount;
const safeGateAt=(requested:number,previous:number)=>{
  // Find the nearest *ordered* clear crossing, not a radial trigger beside
  // either gap. Keeping gates between nominal neighbors prevents bunching.
  for(let step=0;step<=120;step++){
    for(const direction of [1,-1]){
      const s=requested+direction*step*.25;
      if(s<=previous+9 || s>=DESERT_TRACK_LENGTH-7)continue;
      const p=desertTrackSampleAt(s);
      if(DESERT_JUMPS.every(j=>dist(p,j.point)>j.landing+3.8))return s;
    }
  }
  throw new Error("No safe checkpoint near s="+requested);
};
const authoredGates:TrialGate[]=[];
for(let i=0;i<JOSHUA_TRIAL.checkpointCount;i++) {
  const s=i===0?0:safeGateAt(i*spacing,authoredGates.at(-1)!.s);
  authoredGates.push({id:i===0?"start-finish":`checkpoint-${i}`,
    s,point:desertTrackSampleAt(s),forward:headingAt(s),
    halfWidth:JOSHUA_TRIAL.gateHalfWidth});
}
export const JOSHUA_GATES:readonly TrialGate[]=authoredGates;
export type TrialState={
  phase:TrialPhase;nextGate:number;elapsedMs:number;
  splitsMs:readonly number[];reason?:string;ghostPlace?:number;
};
export function armJoshuaTrial():TrialState {
  return {phase:"armed",nextGate:0,elapsedMs:0,splitsMs:[]};
}
export function abortJoshuaTrial(s:TrialState,reason="Interrupted"):TrialState{
 if(s.phase!=="armed"&&s.phase!=="running")return s;
 return {...s,phase:"invalidated",reason};
}
/** Signed gate-plane sweep with lateral intersection, not proximity-only. */
export function crossedTrialGate(from:Point,to:Point,gate:TrialGate):boolean {
  const signed=(p:Point)=>(p.x-gate.point.x)*gate.forward.x+
    (p.z-gate.point.z)*gate.forward.z;
  const a=signed(from),b=signed(to);
  if(!(a<0&&b>=0))return false;
  const fraction=-a/(b-a);
  const x=from.x+(to.x-from.x)*fraction-gate.point.x;
  const z=from.z+(to.z-from.z)*fraction-gate.point.z;
  return Math.abs(x*gate.forward.z-z*gate.forward.x)<=gate.halfWidth;
}
export function tickJoshuaTrial(s:TrialState,from:Point,to:Point,dt:number,
  mode:string,paused=false):TrialState {
  if(s.phase!=="armed"&&s.phase!=="running")return s;
  if(mode!==JOSHUA_TRIAL.requiredMode)return abortJoshuaTrial(s,"Bike mode required");
  if(paused)return abortJoshuaTrial(s,"Paused or hidden");
  if(!Number.isFinite(dt)||dt<0||dt>.075)return abortJoshuaTrial(s,"Invalid frame interval");
  if(dist(from,to)>Math.max(.75,22*dt+0.2))
    return abortJoshuaTrial(s,"Movement discontinuity");
  const corridor=desertTrackFrame(to).distance;
  if(corridor>4.0&&!desertBypassClearance(to))
    return abortJoshuaTrial(s,"Left the marked riding corridor");
  const gate=JOSHUA_GATES[s.nextGate]??JOSHUA_FINISH_GATE;
  const crossed=crossedTrialGate(from,to,gate);
  if(s.phase==="armed")return crossed?
    {phase:"running",nextGate:1,elapsedMs:0,splitsMs:[]}:s;
  const elapsedMs=s.elapsedMs+dt*1000;
  if(!crossed)return {...s,elapsedMs};
  const nextGate=s.nextGate+1;
  // After gate 11, finish requires a *second* correct crossing of start.
  if(s.nextGate===JOSHUA_GATES.length) return {
    phase:"complete",nextGate,elapsedMs,splitsMs:[...s.splitsMs,elapsedMs],
  };
  return {...s,elapsedMs,nextGate,splitsMs:[...s.splitsMs,elapsedMs]};
}
/** The 12th sequential gate is the finish plane again after the whole lap.
 * Uses an explicit virtual gate rather than indexing undefined. */
export const JOSHUA_FINISH_GATE=JOSHUA_GATES[0];
