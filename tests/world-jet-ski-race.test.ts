import assert from "node:assert/strict";
import test from "node:test";
import {isWater,WORLD_BOUNDS} from "../lib/world/model";
import {JET_SKI_START,JET_SKI_GATES,JET_SKI_PROFILES,jetSkiGateDistance,
 jetSkiNavigableWater,jetSkiBearingToGate,
 startJetSkiRace,stepJetSkiRace} from "../lib/world/jetSkiRace";
test("dock launch and all coastal checkpoints are navigable water",()=>{
 assert.ok(isWater(JET_SKI_START));
 for(const g of JET_SKI_GATES)assert.ok(jetSkiNavigableWater(g),JSON.stringify(g));
 const all=[JET_SKI_START,...JET_SKI_GATES];
 for(let i=1;i<all.length;i++){
  const a=all[i-1],b=all[i];
  for(let k=0;k<=50;k++){
   const t=k/50,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
   assert.ok(jetSkiNavigableWater(p),`dry shortcut on segment ${i} at ${JSON.stringify(p)}`);
  }
 }
 assert.ok(JET_SKI_GATES.some(g=>g.z>WORLD_BOUNDS.maxZ+14));
 assert.ok(JET_SKI_GATES.some(g=>g.z<WORLD_BOUNDS.minZ-14));
 assert.ok(JET_SKI_GATES.some(g=>g.x< -40));
 assert.ok(JET_SKI_GATES.some(g=>g.x>65));
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
 assert.equal(next.penalties,1,"one impact, not one penalty per substep");
 const stillBlocked=stepJetSkiRace(next,.1,{throttle:1,steer:0},()=>false);
 assert.equal(stillBlocked.penalties,1);
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

test("navigable ocean stays bounded and does not flood island interiors",()=>{
 assert.equal(jetSkiNavigableWater({x:0,z:0}),false);
 assert.equal(jetSkiNavigableWater({x:0,z:WORLD_BOUNDS.maxZ+24}),true);
 assert.equal(jetSkiNavigableWater({x:0,z:WORLD_BOUNDS.minZ-24}),true);
 assert.equal(jetSkiNavigableWater({x:0,z:180}),false);
 assert.equal(jetSkiNavigableWater({x:300,z:20}),false);
});
test("compass bearing directs first checkpoint from the dock",()=>{
 const start=startJetSkiRace();
 const heading=jetSkiBearingToGate(start);
 assert.ok(heading>0&&heading<Math.PI/2);
});
test("swept checkpoint awards exactly one gate for a fast crossing",()=>{
 const state={...startJetSkiRace(),position:{x:75,z:30},
  heading:0,speed:28};
 const after=stepJetSkiRace(state,.11,{throttle:1,steer:0},()=>true);
 assert.equal(after.checkpoint,1);
});
test("one long tick agrees with equivalent smaller physics steps",()=>{
 const input={throttle:1,steer:.4};
 const a=stepJetSkiRace(startJetSkiRace(),.1,input,()=>true);
 let b=startJetSkiRace();
 for(let i=0;i<10;i++)b=stepJetSkiRace(b,.01,input,()=>true);
 assert.ok(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<.01);
 assert.ok(Math.abs(a.heading-b.heading)<.001);
});
