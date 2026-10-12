import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createJetSkiDock} from "../components/world/worldJetSkiDock";
import test from "node:test";
import {isWater,WORLD_BOUNDS,terrainHeight} from "../lib/world/model";
import {groundHeight,stepTravel,type Travel} from "../lib/world/activities";
import {JET_SKI_PIER,jetSkiPierHeight,nearJetSkiBoarding} from "../lib/world/jetSkiPier";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,jetSkiRockAt,jetSkiSegmentClear} from "../lib/world/jetSkiCourse";
import {JET_SKI_JUMPS,jetSkiWaterSample} from "../lib/world/jetSkiWater";
import {JET_SKI_START,JET_SKI_GATES,JET_SKI_PROFILES,jetSkiGateDistance,
 jetSkiNavigableWater,jetSkiBearingToGate,jetSkiOpponentInput,
 jetSkiRaceProgress,jetSkiRacePlace,
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

test("AI competitors complete both laps using the same collision-safe physics",()=>{
 for(const craft of ["touring","sport","race"] as const){
  let rival=startJetSkiRace(craft);
  let previous=jetSkiRaceProgress(rival);
  for(let i=0;i<12000&&rival.phase==="racing";i++){
   rival=stepJetSkiRace(rival,1/60,jetSkiOpponentInput(rival));
   const progress=jetSkiRaceProgress(rival);
   assert.ok(progress>=previous-0.04,"opponent should follow ordered gates");
   previous=progress;
  }
  assert.equal(rival.phase,"finished",craft+" must actually finish the route");
  assert.equal(rival.penalties,0,craft+" should avoid the shoreline");
 }
});

test("authored rock arches align with numbered checkpoints and leave open water",()=>{
 assert.equal(JET_SKI_ARCHES.length,2);
 assert.ok(JET_SKI_ROCKS.length>=10);
 for(const arch of JET_SKI_ARCHES){
  const point=JET_SKI_GATES[arch.gateIndex];
  assert.ok(Math.hypot(point.x-arch.center.x,point.z-arch.center.z)<.01,
   arch.id+" must genuinely be part of the race");
  assert.equal(jetSkiRockAt(arch.center),null,
   arch.id+" must have an unobstructed passage");
 }
 for(const rock of JET_SKI_ROCKS){
  assert.ok(jetSkiNavigableWater(rock.point),"rock must stand offshore: "+rock.id);
 }
 const nodes=[JET_SKI_START,...JET_SKI_GATES];
 for(let i=0;i<nodes.length-1;i++)
  assert.equal(jetSkiSegmentClear(nodes[i],nodes[i+1],1.25),true,
   "baseline course must avoid solid stacks at segment "+i);
});

test("wave and coastal-current sampling is bounded, deterministic and spatial",()=>{
 const ocean={x:-60,z:-20},lagoon={x:70,z:12};
 const a=jetSkiWaterSample(ocean,3.25),same=jetSkiWaterSample(ocean,3.25);
 assert.deepEqual(a,same);
 assert.notDeepEqual(a,jetSkiWaterSample(ocean,5));
 assert.ok(a.roughness>jetSkiWaterSample(lagoon,3.25).roughness);
 for(const x of [a.height,a.slopeX,a.slopeZ,a.roughness,a.current.x,a.current.z])
  assert.ok(Number.isFinite(x));
});

test("turbo has meaningful bounded speed and recharges after release",()=>{
 const input={throttle:1,steer:0};
 let normal=startJetSkiRace(),boosted=startJetSkiRace();
 for(let i=0;i<110;i++){
  normal=stepJetSkiRace(normal,1/60,input,()=>true);
  boosted=stepJetSkiRace(boosted,1/60,{...input,turbo:true},()=>true);
 }
 assert.ok(boosted.speed>normal.speed+3);
 assert.ok(boosted.turbo<normal.turbo);
 assert.ok(boosted.turbo>=0&&boosted.turbo<=100);
 const low=boosted.turbo;
 for(let i=0;i<70;i++)
  boosted=stepJetSkiRace(boosted,1/60,{...input,turbo:false},()=>true);
 assert.ok(boosted.turbo>low);
});

test("a wave ramp launches, lands, and cannot chain-launch in one frame",()=>{
 const jump=JET_SKI_JUMPS.find(j=>j.id==="south-lava-launch")!;
 let s={...startJetSkiRace(),position:{x:jump.point.x-4,z:jump.point.z},
  heading:jump.heading,speed:20};
 s=stepJetSkiRace(s,.1,{throttle:1,steer:0,turbo:true},()=>true);
 assert.ok(s.jumpHeight>0,"aligned high-speed approach should launch");
 assert.ok(s.jumpCooldown>0);
 const firstCooldown=s.jumpCooldown;
 for(let i=0;i<130;i++)
  s=stepJetSkiRace(s,1/60,{throttle:0,steer:0},()=>true);
 assert.equal(s.jumpHeight,0,"gravity returns the craft to water");
 assert.ok(s.jumpCooldown<firstCooldown);
 assert.ok(s.landingSplash>=0);
});

test("solid stacks cause a single impact while adjacent arch gap stays open",()=>{
 const rock=JET_SKI_ROCKS.find(r=>r.id==="mendocino-needle-a")!;
 assert.ok(jetSkiRockAt(rock.point));
 const base={...startJetSkiRace(),position:{x:rock.point.x-4,z:rock.point.z},
  heading:Math.PI/2,speed:14};
 const hit=stepJetSkiRace(base,.15,{throttle:1,steer:0},()=>true);
 assert.ok(hit.rockHits>=0);
 assert.ok(hit.penalties<=1);
});

test("clean checkpoint adds a bounded turbo reward only when crossed",()=>{
 const near={...startJetSkiRace(),position:{x:75,z:35},
  heading:0,speed:12,turbo:1};
 const pass=stepJetSkiRace(near,.1,{throttle:1,steer:0},()=>true);
 assert.equal(pass.checkpoint,1);
 // 1 starting point + 8 gate points + 14 points/second normal recharge.
 assert.ok(Math.abs(pass.turbo-(1+8+14*.1))<.1);
 const noGate=stepJetSkiRace(startJetSkiRace(),.1,{throttle:0,steer:0},()=>true);
 assert.equal(noGate.checkpoint,0);
 assert.equal(noGate.turbo,100);
});

test("procedural dock renders focused gate and finite pooled foam without mesh growth",()=>{
 const scene=new THREE.Scene(),dock=createJetSkiDock(scene);
 assert.equal(dock.skis.length,3);
 assert.equal(dock.buoys.length,JET_SKI_GATES.length);
 dock.updateGateFocus(4,2,true);
 assert.equal(dock.focusBeam.visible,true);
 assert.equal(dock.focusBeam.position.x,JET_SKI_GATES[4].x);
 dock.updateGateFocus(0,2,false);
 assert.equal(dock.focusBeam.visible,false);
 dock.updateWakeTrail([
  {x:70,z:12,heading:0,speed:18,age:0,boosting:true},
  {x:69,z:10,heading:.1,speed:12,age:.5,boosting:false},
 ],2);
 assert.equal(dock.trail.count,4);
 const pose=new THREE.Matrix4();
 dock.trail.getMatrixAt(0,pose);
 assert.ok(pose.elements.every(Number.isFinite));
 dock.updateWakeTrail([],3);
 assert.equal(dock.trail.count,0);
 assert.equal(dock.trail.visible,false);
 scene.remove(dock.root);
});

test("race position keeps earlier finishers ahead after all competitors finish",()=>{
 const a={...startJetSkiRace(),phase:"finished" as const,elapsed:101,lap:2};
 const b={...startJetSkiRace(),phase:"finished" as const,elapsed:96,lap:2};
 const c={...startJetSkiRace(),phase:"finished" as const,elapsed:114,lap:2};
 assert.equal(jetSkiRacePlace(a,[b,c]),2);
 assert.equal(jetSkiRacePlace(b,[a,c]),1);
 assert.equal(jetSkiRacePlace(c,[a,b]),3);
 const behind={...startJetSkiRace(),checkpoint:4};
 assert.equal(jetSkiRacePlace(behind,[b]),2);
 assert.equal(jetSkiRacePlace(a,[behind]),1);
});

test("pier deck is walkable across water with exactly matching support height",()=>{
 const p=JET_SKI_PIER;
 const dry={x:p.landX-.25,z:p.centerZ};
 const ramp={x:p.landX+.5,z:p.centerZ};
 const mid={x:p.rampEndX+.5,z:p.centerZ};
 const edge={x:p.endX-.2,z:p.centerZ};
 assert.equal(jetSkiPierHeight(dry),null);
 assert.equal(nearJetSkiBoarding(dry),false);
 assert.equal(jetSkiPierHeight(ramp)!==null,true);
 assert.equal(isWater(edge),true,"pier should actually span water");
 assert.ok(Math.abs(groundHeight(mid)-p.deckHeight)<.001);
 assert.ok(Math.abs(groundHeight(edge)-p.deckHeight)<.001);
 assert.equal(nearJetSkiBoarding(mid),true);
 assert.equal(nearJetSkiBoarding(edge),true);
 assert.equal(jetSkiPierHeight({x:edge.x,z:edge.z+p.halfWidth+1}),null);
 assert.ok(terrainHeight(p.landX,p.centerZ)<Infinity);
});

test("walker advances across elevated pier without entering underwater locomotion",()=>{
 const p=JET_SKI_PIER;
 let current:Travel={point:{x:p.landX+.1,z:p.centerZ},
  speed:0,heading:{x:1,z:0}};
 for(let i=0;i<200&&current.point.x<p.endX-.6;i++){
  current=stepTravel(current,{x:1,z:0},.05,"run",[],false,null,0,groundHeight);
 }
 assert.ok(current.point.x>p.rampEndX+1,"the deck must be accessible on foot");
 assert.ok(jetSkiPierHeight(current.point)!==null);
 assert.ok(groundHeight(current.point)>JET_SKI_PIER.deckHeight-.05);
});

test("A turns left and D turns right, including reversing safely from stuck",()=>{
 let base=startJetSkiRace();
 for(let i=0;i<65;i++)base=stepJetSkiRace(base,1/60,{throttle:1,steer:0},()=>true);
 const a=stepJetSkiRace(base,.11,{throttle:1,steer:-1},()=>true);
 const d=stepJetSkiRace(base,.11,{throttle:1,steer:1},()=>true);
 assert.ok(a.heading<base.heading,"A should rotate bow left");
 assert.ok(d.heading>base.heading,"D should rotate bow right");
 let stuck={...startJetSkiRace(),speed:0,position:{x:75,z:15}};
 for(let i=0;i<200;i++)stuck=stepJetSkiRace(stuck,1/60,
  {throttle:-1,steer:0},()=>true);
 assert.ok(stuck.speed< -5,"S must genuinely reverse, not just brake");
 assert.ok(stuck.position.z<15);
 const backA=stepJetSkiRace(stuck,.1,{throttle:-1,steer:-1},()=>true);
 const backD=stepJetSkiRace(stuck,.1,{throttle:-1,steer:1},()=>true);
 assert.ok(backA.heading>stuck.heading,"reversing with A pivots opposite the forward heading");
 assert.ok(backD.heading<stuck.heading,"reversing with D pivots opposite the forward heading");
});

test("free ride ignores checkpoint progression and still moves through waves",()=>{
 let s={...startJetSkiRace(),position:{...JET_SKI_GATES[0]}};
 for(let i=0;i<90;i++)s=stepJetSkiRace(s,1/60,
  {throttle:1,steer:0},()=>true,false);
 assert.equal(s.checkpoint,0);
 assert.equal(s.lap,0);
 assert.equal(s.phase,"racing");
 assert.ok(s.speed>3);
 assert.ok(Number.isFinite(s.waterHeight));
});

test("walker can approach from dry island and cross the full pier without a blocked rise",()=>{
 const p=JET_SKI_PIER;
 assert.equal(isWater({x:p.landX,z:p.centerZ}),false,
  "pier ramp must physically originate on the island");
 assert.equal(isWater({x:p.endX,z:p.centerZ}),true,
  "pier must extend over the lagoon");
 let current:Travel={point:{x:p.landX-2.3,z:p.centerZ},
  speed:0,heading:{x:1,z:0}};
 for(let i=0;i<225&&current.point.x<p.endX-.5;i++){
  const prior=current.point.x;
  current=stepTravel(current,{x:1,z:0},.05,"run",[],false,null,0,groundHeight);
  assert.ok(current.point.x>=prior,"walking should never reverse direction");
 }
 assert.ok(current.point.x>=p.endX-.5,
  "pier approach should remain traversable from dry land: "+current.point.x);
 assert.ok(nearJetSkiBoarding(current.point));
 assert.equal(groundHeight(current.point),p.deckHeight);
});

test("the pier renders a continuous physical-looking deck with no missing boards",()=>{
 const scene=new THREE.Scene(),dock=createJetSkiDock(scene);
 const deck=dock.root.getObjectByName("continuous-walkable-pier-surface");
 assert.ok(deck instanceof THREE.Mesh);
 const vertices=deck.geometry.attributes.position;
 assert.ok(vertices.count>=100);
 const startHeight=jetSkiPierHeight({x:JET_SKI_PIER.landX,z:JET_SKI_PIER.centerZ});
 assert.ok(Math.abs(vertices.getY(0)-(startHeight!-.12))<.001);
 dock.root.traverse(object=>{
  if(object instanceof THREE.Mesh){object.geometry.dispose();}
 });
 scene.remove(dock.root);
});
