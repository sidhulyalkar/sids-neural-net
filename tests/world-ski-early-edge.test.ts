import assert from "node:assert/strict";
import test from "node:test";
import {createTrial,inside} from "../app/dev/ski-lab/fiveCarve";
import {EarlyEdgeController,runEarlyEdge,sweepEarlyEdge} from "../app/dev/ski-lab/earlyEdge";
import {neutral,tuning} from "../lib/world/ski/simulation";

test("late-controller reproduces the unqualified V3-1 reference, never silently claiming five carves",()=>{
 const control=runEarlyEdge(0);
 assert.equal(control.visited,1);
 assert.equal(control.traversals,0);
 assert.equal(control.exit,"footprint");
 assert.equal(control.bankVisits[0]?.bank,1);
 assert.ok(control.bankVisits[0].tick>=690&&control.bankVisits[0].tick<=720);
 assert.ok(control.ticks>=815&&control.ticks<=850);
 assert.equal(control.reversals[0]?.early,false);
});

test("early-edge variants steer before the physical bank, without moving its threshold",()=>{
 for(const lead of [1,1.5,2]){
  const result=runEarlyEdge(lead);
  const first=result.reversals[0];
  assert.ok(first,`lead ${lead} had no reversal`);
  assert.equal(first.early,true);
  assert.ok(first.tick<706,`lead ${lead} reversed after the original bank visit`);
  assert.ok(first.distanceToBank>0);
  assert.ok(first.distanceToBank<=lead+.12);
  assert.ok(result.maxStep<.5,"no teleport or per-step position reset");
  assert.equal(result.frames.length,result.inputs.length);
  assert.equal(result.ticks,result.frames.length);
  assert.equal(result.initial.x,7);
  assert.equal(result.initial.z,-57);
  assert.equal(result.initial.vx,6);
  assert.equal(result.initial.vz,3);
  assert.ok(result.visited<=6);
  assert.equal(result.traversals,Math.max(0,result.visited-1));
  assert.ok(result.frames.every(f=>Number.isFinite(f.signedSlip)&&Number.isFinite(f.heading)));
 }
});

test("a bank threshold is not falsely credited when steering reverses in the center",()=>{
 const controller=new EarlyEdgeController(2.5);
 const sim=createTrial();
 sim.position.x=7;
 sim.velocity.x=6;
 const first=controller.input(sim);
 assert.ok(first.steer>0);
 assert.equal(controller.visits,0);
 const probe=runEarlyEdge(3);
 assert.equal(probe.traversals,Math.max(0,probe.visited-1));
 assert.ok(probe.bankVisits.every(v=>Math.abs(v.x-7)>=4.35&&inside(v.x,v.z)));
 assert.throws(()=>new EarlyEdgeController(-1));
 assert.throws(()=>new EarlyEdgeController(NaN));
 assert.throws(()=>new EarlyEdgeController(20));
});

test("all lead trials finish with an explicit observed outcome, not a preset pass",()=>{
 const results=sweepEarlyEdge();
 assert.equal(results.length,7);
 for(const result of results){
  assert.ok(["five-traversals","footprint","time-limit"].includes(result.exit));
  assert.ok(result.frames.length>0);
  assert.equal(result.tuningVersion,tuning.version);
 }
});

test("early-edge trace replays to identical state across render frame cadences",()=>{
 const evidence=runEarlyEdge(1.5);
 const expected=createTrial();
 for(const input of evidence.inputs)expected.advance(tuning.dt,()=>input);
 const snapshot=(sim:typeof expected)=>[
  sim.tick,...sim.position,...sim.velocity,...sim.rotation,
  sim.edge,sim.pressure,sim.grip,sim.phase,...sim.contact.map(Number)
 ];
 for(const fps of [20,30,60,120]){
  const replay=createTrial();
  for(let frame=0;replay.tick<evidence.inputs.length;frame++){
   const dt=Math.min((frame%2?.84:1.16)/fps,
    (evidence.inputs.length-replay.tick)*tuning.dt-replay.remainder);
   replay.advance(dt,tick=>evidence.inputs[tick]??neutral);
  }
  assert.deepEqual(snapshot(replay),snapshot(expected),`replay at ${fps} fps`);
 }
});
