import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {FlexibleSoles} from "../app/dev/ski-lab/flexibleSoles";
import {runEarlyEdge} from "../app/dev/ski-lab/earlyEdge";
import {createTrial} from "../app/dev/ski-lab/fiveCarve";
import {tuning} from "../lib/world/ski/simulation";

const out=process.env.SKI_AUDIT_DIR??"artifacts/ski-flex-sole";
mkdirSync(out,{recursive:true});
const control=runEarlyEdge(0);
const first=control.bankVisits[0]?.tick;
if(!first)throw Error("Missing baseline physical bank visit");
const selected=new Set([1,Math.max(1,first-30),first,first+30]);
const sim=createTrial(),models=[
 new FlexibleSoles("rigid"),
 new FlexibleSoles("bounded",.3),
 new FlexibleSoles("surface")
] as const;
const frames=[];
try{
 for(const input of control.inputs){
  sim.advance(tuning.dt,()=>input);
  if(!selected.has(sim.tick))continue;
  frames.push({tick:sim.tick,x:sim.position.x,z:sim.position.z,
   phase:sim.phase,physicalFlags:[...sim.contact],
   modes:Object.fromEntries(models.map(m=>[m.mode,m.update(sim).map(g=>({...g}))]))});
 }
}finally{for(const m of models)m.dispose();}
const report={schema:"iland-ski-flex-sole-v1",tuningVersion:tuning.version,
 sourceControl:"PR160 late bank steering",firstBankTick:first,
 maxDeflection:.3,footprint:"33 x 3 sampled sole vertices, 99 per ski",
 validation:"DIAGNOSTIC ONLY: physical collider remains 2-point; no hardware-backed visual acceptance",
 frames};
writeFileSync(join(out,"rigid-bounded-surface.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
