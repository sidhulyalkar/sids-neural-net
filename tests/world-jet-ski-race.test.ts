import assert from "node:assert/strict";
import test from "node:test";
import {isWater} from "../lib/world/model";
import {JET_SKI_START,JET_SKI_GATES,JET_SKI_PROFILES,jetSkiGateDistance,
 startJetSkiRace,stepJetSkiRace} from "../lib/world/jetSkiRace";
test("dock launch and all coastal checkpoints are navigable water",()=>{
 assert.ok(isWater(JET_SKI_START));
 for(const g of JET_SKI_GATES)assert.ok(isWater(g),JSON.stringify(g));
});
test("all three jet skis have ordered arcade handling",()=>{
 assert.ok(JET_SKI_PROFILES.race.maxSpeed>JET_SKI_PROFILES.sport.maxSpeed);
 assert.ok(JET_SKI_PROFILES.sport.maxSpeed>JET_SKI_PROFILES.touring.maxSpeed);
 for(const type of ["touring","sport","race"] as const){
  const s=startJetSkiRace(type);
  assert.equal(s.craft,type);
  assert.equal(s.checkpoint,0);
  assert.equal(s.lap,0);
 }
});
test("throttle accelerates and zero throttle slows the hull",()=>{
 let s=startJetSkiRace();
 for(let i=0;i<60;i++)s=stepJetSkiRace(s,1/60,{throttle:1,steer:0},()=>true);
 assert.ok(s.speed>5);
 const cruising=s.speed;
 for(let i=0;i<100;i++)s=stepJetSkiRace(s,1/60,{throttle:0,steer:0},()=>true);
 assert.ok(s.speed<cruising);
 assert.ok(s.elapsed>2);
});
test("shore prevents moving onto land",()=>{
 const s=startJetSkiRace();
 const next=stepJetSkiRace(s,.1,{throttle:1,steer:0},()=>false);
 assert.deepEqual(next.position,s.position);
 assert.ok(next.penalties>0);
});
test("gate detection preserves order and completes exactly two laps",()=>{
 let s=startJetSkiRace();
 for(let lap=0;lap<2;lap++){
  for(let gate=0;gate<JET_SKI_GATES.length;gate++){
   s={...s,position:{...JET_SKI_GATES[gate]}};
   assert.equal(jetSkiGateDistance(s),0);
   s=stepJetSkiRace(s,1/120,{throttle:0,steer:0},()=>true);
  }
 }
 assert.equal(s.phase,"finished");
 assert.equal(s.lap,2);
 assert.equal(s.checkpoint,0);
});
