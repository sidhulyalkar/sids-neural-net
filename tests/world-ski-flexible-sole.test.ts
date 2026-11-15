import assert from "node:assert/strict";
import test from "node:test";
import {FlexibleSoles} from "../app/dev/ski-lab/flexibleSoles";
import {runEarlyEdge} from "../app/dev/ski-lab/earlyEdge";
import {createTrial,SoleProbe} from "../app/dev/ski-lab/fiveCarve";
import {neutral,tuning} from "../lib/world/ski/simulation";

function atWorstBridge(){
 const recorded=runEarlyEdge(0);
 const probe=new SoleProbe(),search=createTrial();
 let worstTick=0,worstGap=-Infinity;
 for(const input of recorded.inputs){
  search.advance(tuning.dt,()=>input);
  if(search.phase!=="riding"||!search.contact.some(Boolean))continue;
  const gaps=probe.update(search);
  for(let side=0;side<2;side++){
   if(search.contact[side]&&gaps[side].max>worstGap){
    worstGap=gaps[side].max;worstTick=search.tick;
   }
  }
 }
 assert.ok(worstTick>0);
 assert.ok(worstGap>.5,"measured full-trace rigid bridge should remain visible");
 const sim=createTrial();
 for(const input of recorded.inputs.slice(0,worstTick))sim.advance(tuning.dt,()=>input);
 assert.equal(sim.tick,worstTick);
 assert.ok(sim.contact.some(Boolean));
 return {sim,worstGap,worstTick};
}

test("new rigid geometry reproduces original full-footprint gap measurements",()=>{
 const {sim,worstGap}=atWorstBridge(),probe=new SoleProbe(),original=probe.update(sim);
 const model=new FlexibleSoles("rigid");
 try{
  const candidate=model.update(sim);
  for(let i=0;i<2;i++){
   if(!candidate[i].active)continue;
   assert.ok(Math.abs(candidate[i].min-original[i].min)<1e-6);
   assert.ok(Math.abs(candidate[i].mean-original[i].mean)<1e-6);
   assert.ok(Math.abs(candidate[i].max-original[i].max)<1e-6);
   assert.equal(candidate[i].vertexCount,99);
   assert.equal(candidate[i].maxVerticalBend,0);
  }
  assert.ok(candidate.some(m=>m.active&&Math.abs(m.max-worstGap)<1e-6),
   "comparison must use the actual worst-contact frame, not an assumed bank tick");
 }finally{model.dispose();}
});

test("bounded flex reduces gaps without pretending the rigid ski can bend infinitely",()=>{
 const {sim}=atWorstBridge();
 const rigid=new FlexibleSoles("rigid");
 const bounded=new FlexibleSoles("bounded",.3);
 const ideal=new FlexibleSoles("surface");
 try{
  const rm=rigid.update(sim),bm=bounded.update(sim),im=ideal.update(sim);
  for(let i=0;i<2;i++){
   if(!rm[i].active)continue;
   assert.ok(bm[i].max<=rm[i].max+1e-10);
   assert.ok(bm[i].mean<=rm[i].mean+1e-10);
   assert.ok(bm[i].maxVerticalBend<=.30000001);
   assert.ok(bm[i].maxVerticalBend>0);
   assert.ok(im[i].min>=.0079999&&im[i].max<=.0080001);
   assert.ok(Number.isFinite(im[i].maxCurvature)&&im[i].maxCurvature>=0);
   assert.ok(rm[i].max>im[i].max);
  }
 }finally{rigid.dispose();bounded.dispose();ideal.dispose();}
});

test("airborne skier is not stamped onto snow and all geometry is disposable",()=>{
 const sim=createTrial();
 sim.phase="air";
 sim.contact[0]=sim.contact[1]=true;
 const candidate=new FlexibleSoles("bounded",.3);
 const gaps=candidate.update(sim);
 assert.ok(gaps.every(m=>!m.active&&m.maxVerticalBend===0));
 assert.throws(()=>new FlexibleSoles("bounded",-1));
 candidate.dispose();
});

test("zero deflection is precisely rigid fitting for identical skier state",()=>{
 const sim=createTrial();
 sim.advance(tuning.dt,()=>neutral);
 const original=new FlexibleSoles("rigid"),limit0=new FlexibleSoles("bounded",0);
 try{
  const r=original.update(sim),b=limit0.update(sim);
  for(let i=0;i<2;i++){
   assert.equal(r[i].min,b[i].min);
   assert.equal(r[i].mean,b[i].mean);
   assert.equal(r[i].max,b[i].max);
  }
 }finally{original.dispose();limit0.dispose();}
});
