import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {sweepEarlyEdge} from "../app/dev/ski-lab/earlyEdge";

const out=process.env.SKI_AUDIT_DIR??"artifacts/ski-early-edge";
mkdirSync(out,{recursive:true});
const trials=sweepEarlyEdge();
const summary=trials.map(t=>({
 leadDistance:t.leadDistance,tuningVersion:t.tuningVersion,
 visits:t.visited,traversals:t.traversals,ticks:t.ticks,
 durationSeconds:t.seconds,exit:t.exit,
 firstReversal:t.reversals[0]??null,bankVisits:t.bankVisits,
 maxStep:t.maxStep,
 physics:"diagnostic-only",
 visualQualification:"UNQUALIFIED",
 wholeSiteQualification:"UNQUALIFIED"
}));
writeFileSync(join(out,"summary.json"),JSON.stringify({
 schema:"iland-ski-early-edge-v1",recordedAt:null,
 note:"Immutable V3-1 late-control comparison. Measured against the same footprint, bank threshold, and solver. Record source commit SHA in CI metadata.",
 controls:summary
},null,2)+"\n");
for(const t of trials){
 const name=`lead-${t.leadDistance.toFixed(1)}`;
 const header="tick,t,x,y,z,vx,vy,vz,speed,heading,slip,edge,grip,steer,requestedBank,steeringBank,visits,phase,left,right";
 const rows=t.frames.map(f=>[
  f.tick,f.t,f.x,f.y,f.z,f.vx,f.vy,f.vz,f.speed,f.heading,
  f.signedSlip,f.edge,f.grip,f.steer,f.requestedBank,f.steeringBank,
  f.visits,f.phase,Number(f.leftContact),Number(f.rightContact)
 ].join(","));
 writeFileSync(join(out,name+".csv"),[header,...rows].join("\n")+"\n");
 writeFileSync(join(out,name+"-inputs.json"),JSON.stringify(t.inputs)+"\n");
}
console.table(summary.map(s=>({lead:s.leadDistance,visits:s.visits,
 traversals:s.traversals,exit:s.exit,ticks:s.ticks,
 firstTurn:s.firstReversal?.tick??null})));
