import assert from "node:assert/strict";
import test from "node:test";
import {Vector3} from "three";
import {bank,bankOffset,createTrial,inside,SoleProbe,trialInput} from "../app/dev/ski-lab/fiveCarve";
import {neutral,tuning,type SkiInput} from "../lib/world/ski/simulation";

test("bank visits require grounded displacement inside the footprint",()=>{
 for(const sign of [-1,1]){
  const x=7+sign*(bankOffset+.01);
  assert.equal(bank(x,-47,true),sign);
  assert.equal(bank(x,-47,false),0);
  assert.equal(bank(x,-32,true),0);
  assert.equal(bank(7+sign*2.3,-47,true),0);
 }
});
test("continuous bank trial replays tick by tick across jittered cadences",()=>{
 const original=createTrial(),inputs:SkiInput[]=[],states:number[][]=[];
 const snapshot=(s:typeof original)=>[...s.position,...s.velocity,...s.rotation,s.edge,s.grip,...s.contact.map(Number)];
 let target=1;
 while(inputs.length<3600&&inside(original.position.x,original.position.z)){
  const input=trialInput(original,target);
  states.push(snapshot(original));inputs.push(input);
  original.advance(tuning.dt,()=>input);
  if(bank(original.position.x,original.position.z,original.phase==="riding"&&original.contact.some(Boolean))===target)target=-target;
 }
 for(const fps of [20,30,60,120]){
  const replay=createTrial();
  for(let frame=0;replay.tick<inputs.length;frame++){
   const dt=Math.min((frame%2?.84:1.16)/fps,(inputs.length-replay.tick)*tuning.dt-replay.remainder);
   replay.advance(dt,tick=>{assert.deepEqual(snapshot(replay),states[tick]);return inputs[tick]??neutral;});
  }
  assert.deepEqual(snapshot(replay),snapshot(original));
 }
});
test("fits are independent and sampled clearance exposes bridging",()=>{
 const sim=createTrial();sim.advance(tuning.dt,()=>neutral);
 const probe=new SoleProbe(),stats=probe.update(sim);
 assert.ok(probe.poses[0].position.distanceTo(probe.poses[1].position)>.3);
 for(const g of stats)assert.ok(g.min<=g.mean&&g.mean<=g.max);
 assert.ok(new Vector3().copy(sim.position).distanceTo(probe.poses[0].position)>0);
});
