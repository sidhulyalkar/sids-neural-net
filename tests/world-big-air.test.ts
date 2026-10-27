import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import { isWater,terrainHeight,distance,ARCADE_CAVE,PAPER_CAVE } from "../lib/world/model";
import {
 BIG_AIR,BIG_AIR_BIRDS,advanceBigAir,armBigAir,bigAirBirdCallout,
 bigAirBirdPositions,bigAirChallengeReady,bigAirClearance,bigAirCrossedLip,bigAirTerrainOffset,
 launchBigAir,idleBigAir,mountainJumpEligible,mountainSkiTakeoff,mountainJumpOutwardGain,mountainJumpCameraPose,MOUNTAIN_JUMP_CENTER,type BigAirState,
} from "../lib/world/bigAir";
import { createBigAirBirds } from "../components/world/worldBigAirBirds";

const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
const simulate=(speed:number,dt:number)=>{
  let state=launchBigAir(BIG_AIR.lip,ground(BIG_AIR.lip),speed);
  for(let i=0;i<1100&&state.phase==="flying";i++)
    state=advanceBigAir(state,dt,ground,isWater);
  return state;
};
test("takeoff has a physical snow ramp, separate downhill run-in and clear protected caves",()=>{
 assert.ok(BIG_AIR.start.z<BIG_AIR.lip.z-12);
 assert.ok(bigAirTerrainOffset(BIG_AIR.lip)>.7);
 assert.equal(bigAirTerrainOffset({x:30,z:25}),0);
 assert.ok(!isWater(BIG_AIR.start)&&!isWater(BIG_AIR.lip));
 assert.ok(distance(BIG_AIR.lip,ARCADE_CAVE.entrance)>20);
 assert.ok(distance(BIG_AIR.lip,PAPER_CAVE)>20);
 for(let z=-65;z<=-47;z+=.5){
   assert.ok(bigAirClearance({x:-2,z}),"ski lane without dense obstacles "+z);
   assert.ok(Number.isFinite(ground({x:-2,z})));
 }
});
test("Big Air cannot trigger without arming, ski mode, speed, forward oriented swept crossing",()=>{
 const a={x:-2,z:-49.25},b={x:-2,z:-48.75};
 const h={x:0,z:1};
 assert.ok(bigAirCrossedLip(a,b,h,"ski",14,true));
 for(const [mode,speed,armed,heading] of [
  ["bike",14,true,h],["ski",4,true,h],["ski",14,false,h],
  ["ski",14,true,{x:0,z:-1}],
 ] as const){
  assert.ok(!bigAirCrossedLip(a,b,heading,mode,speed,armed));
 }
 assert.ok(!bigAirCrossedLip(b,a,h,"ski",14,true));
 assert.ok(!bigAirCrossedLip({x:.3,z:-49.2},{x:.3,z:-48.8},h,"ski",14,true));
 assert.equal(armBigAir().phase,"armed");
 assert.equal(idleBigAir().phase,"idle");
});
test("ordinary skiing never opts into Big Air, only explicit menu arming does",()=>{
 for(const phase of ["idle","landed","missed","flying"] as const){
  assert.equal(bigAirChallengeReady(phase,"ski"),false,phase);
 }
 assert.equal(bigAirChallengeReady("armed","run"),false);
 assert.equal(bigAirChallengeReady("armed","bike"),false);
 assert.equal(bigAirChallengeReady("armed","skate"),false);
 assert.equal(bigAirChallengeReady("armed","ski"),true);
 // The mountain slope may be physically jumpable without granting game ownership.
 const slope={x:8,z:-54};
 assert.ok(mountainJumpEligible(slope,18,12));
 assert.equal(bigAirChallengeReady(idleBigAir().phase,"ski"),false);
 assert.equal(bigAirChallengeReady(armBigAir().phase,"ski"),true);
});
test("flight travels across open valley and lands on ground, with real distance",()=>{
 const state=simulate(15,.05);
 assert.equal(state.phase,"landed",JSON.stringify(state));
 assert.ok(state.distance>35 && state.distance<65);
 assert.ok(state.airtime>2 && state.airtime<6);
 assert.ok(Math.abs(state.y-ground(state.point))<.001);
 assert.ok(!isWater(state.point));
 assert.equal(state.landingQuality,"clean");
 assert.equal(state.distance,Math.hypot(
   state.point.x-BIG_AIR.lip.x,state.point.z-BIG_AIR.lip.z));
});
test("landing is time-step robust and never floats through terrain",()=>{
 const a=simulate(15,.05),b=simulate(15,.0125);
 assert.equal(a.phase,b.phase);
 assert.ok(Math.abs(a.distance-b.distance)<.5,
   `swept landings differ: ${a.distance} vs ${b.distance}`);
 assert.ok(Math.abs(a.airtime-b.airtime)<.05);
 let state=launchBigAir(BIG_AIR.lip,ground(BIG_AIR.lip),15);
 let above=0;
 for(let i=0;i<100&&state.phase==="flying";i++){
   state=advanceBigAir(state,.05,ground,isWater);
   if(state.phase==="flying"){
     assert.ok(state.y>=ground(state.point)-1e-4);
     if(state.y-ground(state.point)>2)above++;
   }
 }
 assert.ok(above>=5,"genuine free flight above valley");
 const invalid=advanceBigAir(launchBigAir(BIG_AIR.lip,ground(BIG_AIR.lip),15),.5,ground,isWater);
 assert.equal(invalid.phase,"missed");
 assert.equal(advanceBigAir(a,.05,ground,isWater),a,"landed state is terminal");
});
test("two macaws and a parrot accompany flight, with factual distance callouts",()=>{
 assert.deepEqual(BIG_AIR_BIRDS.map(b=>b.kind),["macaw","macaw","parrot"]);
 const flight=launchBigAir(BIG_AIR.lip,ground(BIG_AIR.lip),15);
 const birds=bigAirBirdPositions(flight,1.5);
 assert.equal(birds.length,3);
 for(const [i,p] of birds.entries()){
   assert.ok(Math.abs(p.x-flight.point.x)>2.7);
   assert.ok(p.y>flight.y+.8);
   assert.ok(p.z>flight.point.z);
   assert.ok(BIG_AIR_BIRDS[i].color.startsWith("#"));
 }
 assert.deepEqual(bigAirBirdPositions(flight,1.5),birds);
 assert.notDeepEqual(bigAirBirdPositions(flight,2),birds);
 assert.deepEqual(bigAirBirdPositions({...flight,phase:"landed"},2),[]);
 assert.equal(bigAirBirdCallout(7),null);
 assert.equal(bigAirBirdCallout(23),"Blue-and-gold macaw · 20 m");
 assert.equal(bigAirBirdCallout(32),"Scarlet macaw · 30 m");
});
test("bird flock has three draw calls, is hidden outside flight and disposes correctly",()=>{
 const scene=new THREE.Scene();
 const birds=createBigAirBirds(scene);
 assert.equal(birds.count,3);assert.equal(birds.drawCalls,3);
 assert.equal(scene.children.length,3);
 const flight=launchBigAir(BIG_AIR.lip,ground(BIG_AIR.lip),15);
 birds.update(flight,1.2,false);
 assert.equal(birds.active,true);
 assert.ok(scene.children.every(o=>o.visible&&o instanceof THREE.InstancedMesh));
 birds.update({...flight,phase:"landed"},1.5,false);
 assert.equal(birds.active,false);
 assert.ok(scene.children.every(o=>!o.visible));
 birds.dispose();
 assert.equal(scene.children.length,0);
});

test("mountain launches can begin on many slopes and travel in chosen heading",()=>{
 assert.equal(mountainJumpEligible({x:8,z:-54},18,12),true);
 assert.equal(mountainJumpEligible({x:8,z:-54},18,1),false);
 assert.equal(mountainJumpEligible({x:60,z:13},18,12),false);
 assert.equal(mountainJumpEligible({x:8,z:-54},1,12),false);
 const start={x:7,z:-58};
 const alternate=launchBigAir(start,12,15,{x:1,z:0},true);
 assert.equal(alternate.freeTerrain,true);
 assert.deepEqual(alternate.heading,{x:1,z:0});
 assert.deepEqual(alternate.takeoff,start);
 const levelGround=(p:{x:number;z:number})=>p.x>18?0:12;
 let flight=alternate;
 for(let i=0;i<180&&flight.phase==="flying";i++)
   flight=advanceBigAir(flight,.05,levelGround,()=>false);
 assert.equal(flight.phase,"landed",JSON.stringify(flight));
 assert.ok(flight.point.x>start.x+10);
 assert.ok(Math.abs(flight.point.z-start.z)<1e-3);
 assert.ok(flight.distance>10);
 assert.ok(Math.abs((flight.radialDistance??0)-
   Math.hypot(flight.point.x-MOUNTAIN_JUMP_CENTER.x,
     flight.point.z-MOUNTAIN_JUMP_CENTER.z))<.001);
});

test("flock positions stay alongside skier even when jumping across slope",()=>{
 const flight=launchBigAir({x:9,z:-55},14,14,{x:1,z:0},true);
 const birds=bigAirBirdPositions(flight,1.3);
 assert.equal(birds.length,3);
 assert.ok(birds.every(p=>p.x>flight.point.x),
  "birds should fly ahead in +X, not in the old fixed +Z direction");
 assert.ok(birds.some(p=>p.z>flight.point.z+2));
 assert.ok(birds.some(p=>p.z<flight.point.z-2));
 assert.ok(birds.every(p=>Math.abs(p.yaw-Math.PI/2)<.001));
});

test("mountain slope physics can detect takeoffs without granting challenge ownership",()=>{
 const point={x:24,z:-62};
 assert.equal(mountainSkiTakeoff(point,16,11,16.1,14.5),true);
 assert.equal(mountainSkiTakeoff(point,16,11,16,16,6),true);
 assert.equal(mountainSkiTakeoff(point,16,11,16,16,0),false);
 assert.equal(mountainSkiTakeoff(point,16,2,16.2,12,8),false);
 assert.equal(mountainSkiTakeoff({x:70,z:12},16,11,16.5,10,8),false);
});

test("every genuine free-terrain ski touchdown counts even under five meters",()=>{
 const launch=launchBigAir({x:7,z:-58},12,5.3,{x:1,z:0},true);
 const steepGround=(p:{x:number;z:number})=>12+Math.max(0,p.x-7)*4;
 let flight=launch;
 for(let i=0;i<120&&flight.phase==="flying";i++)
   flight=advanceBigAir(flight,.025,steepGround,()=>false);
 assert.equal(flight.phase,"landed",JSON.stringify(flight));
 assert.ok(flight.distance>=0&&flight.distance<5,
  "short slope hops still receive landing scores");
 assert.equal(flight.reason,undefined);
 assert.ok(Number.isFinite(flight.radialDistance));
});

test("manual mountain takeoff requires actual travel momentum, without phantom standstill flights",()=>{
 const p={x:8,z:-54};
 assert.equal(mountainJumpEligible(p,20,0),false);
 assert.equal(mountainJumpEligible(p,20,2.5),false);
 assert.equal(mountainJumpEligible(p,20,5.3),true);
 const slow=launchBigAir(p,20,6,{x:0,z:1},true,0);
 const fast=launchBigAir(p,20,16,{x:0,z:1},true,0);
 const downhill=launchBigAir(p,20,16,{x:0,z:1},true,2.1);
 assert.ok(fast.verticalSpeed>slow.verticalSpeed);
 assert.ok(downhill.verticalSpeed>fast.verticalSpeed);
 assert.ok(downhill.verticalSpeed-fast.verticalSpeed<=1.8);
 assert.equal(slow.takeoffY,20);
 assert.equal(slow.maxClearance,0);
});

test("ski clearance and outward progress measure real terrain and ridge-relative movement",()=>{
 const p={x:8,z:-54};
 let state=launchBigAir(p,18,15,{x:1,z:0},true,1);
 const floor=()=>0;
 for(let i=0;i<20&&state.phase==="flying";i++)
  state=advanceBigAir(state,.05,floor,()=>false);
 assert.ok((state.maxClearance??0)>15,"peak terrain clearance is measured");
 assert.ok(mountainJumpOutwardGain(state)>0);
 assert.ok(Number.isFinite(state.radialDistance));
 const inward=launchBigAir({x:27,z:-61},18,15,{x:-1,z:0},true);
 const later={...inward,point:{x:15,z:-61}};
 assert.ok(mountainJumpOutwardGain(later)<0);
 assert.equal(mountainJumpOutwardGain(idleBigAir()),0);
});

test("flight camera stays behind the skier for all mountain departure headings",()=>{
 for(const dir of [{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0},
  {x:Math.SQRT1_2,z:Math.SQRT1_2}]){
  const state=launchBigAir({x:7,z:-54},20,14,dir,true);
  const pose=mountainJumpCameraPose(state);
  const backward=(pose.camera.x-state.point.x)*dir.x+
   (pose.camera.z-state.point.z)*dir.z;
  const ahead=(pose.look.x-state.point.x)*dir.x+
   (pose.look.z-state.point.z)*dir.z;
  assert.ok(backward< -15&&ahead>5);
  assert.ok(pose.camera.y>state.y+7);
  assert.ok(Object.values(pose.camera).every(Number.isFinite));
  assert.ok(Object.values(pose.look).every(Number.isFinite));
 }
});
