import assert from "node:assert/strict";
import test from "node:test";
import {SkiSimulation,neutral} from "../lib/world/ski/simulation";
const trace=(tick:number)=>({...neutral,jump:tick>=80&&tick<150,steer:tick>=150&&tick<185?.7:0});
test("jittered render cadences replay the same tick inputs",()=>{
 const snapshots=[20,30,60,120].map(fps=>{
  const sim=new SkiSimulation((_x,z)=>-.2*z,0,0);
  for(let frame=0;frame<fps*4;frame++)sim.advance((frame%2?.81:1.19)/fps,trace);
  return [sim.tick,sim.phase,sim.landing,...sim.position.toArray(),...sim.velocity.toArray()];
 });
 assert.equal(snapshots[0][0],480);
 assert.notEqual(snapshots[0][2],"none");
 for(const state of snapshots)assert.deepEqual(state,snapshots[0]);
});
test("release supplies lift, holding alone stays grounded",()=>{
 const sim=new SkiSimulation(()=>0,0,0);
 sim.velocity.z=5;
 for(let i=0;i<60;i++)sim.advance(1/120,()=>({...neutral,jump:true}));
 assert.equal(sim.phase,"charging");
 sim.advance(1/120,()=>neutral);
 assert.equal(sim.phase,"air");
 assert.ok(sim.velocity.y>5 && sim.velocity.z>0);
 for(let i=0;i<240;i++)sim.advance(1/120,()=>neutral);
 assert.equal(sim.landing,"clean");
});
test("moving switch touchdown keeps downhill travel; inverted touchdown falls and recovers",()=>{
 for(const inverted of [false,true]){
  const sim=new SkiSimulation(()=>0,0,0);
  sim.phase="air";sim.position.y=.02;
  sim.rotation.set(inverted?1:0,inverted?0:1,0,0);
  sim.velocity.set(0,-3,4);
  sim.advance(1/120,()=>neutral);
  assert.equal(sim.landing,inverted?"crash":"clean");
  assert.ok(sim.velocity.z>0);
  const phases=new Set<string>([sim.phase]);
  for(let i=0;i<240;i++){sim.advance(1/120,()=>neutral);phases.add(sim.phase);}
  if(inverted)assert.ok(phases.has("recovery"));
  assert.equal(sim.phase,"riding");
 }
});
