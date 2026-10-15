import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createWorldSkimSurf} from "../components/world/worldSkimSurfGeometry";
import {boardPoint,idleSkimHeat,pickupSkimBoard,startSkimRide,stepSkimHeat,
  skimAction,skimWaterHeight,skimOffshore,skimLipCrossing,northShoreZ,
  waveCrestAtX,skimBoardContact} from "../lib/world/skimboarding";

const ride=()=>{const p=boardPoint(1);return startSkimRide(pickupSkimBoard(p,1,idleSkimHeat()),p,11,{x:0,z:1});};
test("a real fast crest crossing gives substantial air, a completed trick and a safe return",()=>{
 const runs=[];
 for(const fps of [20,40,60]){
  let h=ride(),p=boardPoint(1),apex=0,queued=false,landed=false;
  for(let i=1;i<fps*30&&h.phase==="riding";i++){
   const t=i/fps,n=stepSkimHeat(h,p,1/fps,t,0,true);h=n.heat;p=n.point;
   apex=Math.max(apex,h.air);
   if(h.launchKind==="lip-air"&&h.air>.3&&!queued){
    h=skimAction(h,"three-sixty",p,t);queued=true;
   }
   landed ||= h.lastTrick.includes("360 landed");
  }
  assert.ok(queued&&landed,"actual automatic launch and full trick, without pressing pop");
  assert.ok(apex>2.5&&apex<5);
  assert.match(h.lastTrick,/Clean ride/);
  assert.ok(skimOffshore(p)<-9&&h.score>300);
  runs.push({apex,score:h.score});
 }
 assert.ok(Math.max(...runs.map(x=>x.apex))-Math.min(...runs.map(x=>x.apex))<.12);
 assert.ok(Math.max(...runs.map(x=>x.score))-Math.min(...runs.map(x=>x.score))<=3);
});
test("standing near a crest, reversing and slow crossings cannot manufacture lip air",()=>{
 const t=1,x=0,z=northShoreZ(x)+waveCrestAtX(0,x,t);
 const a={x,z:z-.3},b={x,z:z+.2};
 assert.equal(skimLipCrossing(a,b,t,t,{x:0,z:1},10),true);
 assert.equal(skimLipCrossing(b,b,t,t,{x:0,z:1},10),false);
 assert.equal(skimLipCrossing(a,b,t,t,{x:0,z:-1},10),false);
 assert.equal(skimLipCrossing(a,b,t,t,{x:0,z:1},2),false);
});
test("flight stays ballistic when the water moves and last-frame trick presses cannot score",()=>{
 const p=boardPoint(1),surface=(_p:typeof p,t:number)=>t*.8;
 let h=skimAction(ride(),"pop",p,0,surface),point=p;
 const initial=h.flightY!,v=h.verticalSpeed;
 for(let i=1;i<=5;i++){
  const next=stepSkimHeat(h,point,.02,i*.02,0,false,surface);h=next.heat;point=next.point;
 }
 assert.ok(Math.abs(h.flightY!-(initial+v*.1-.5*13.8*.1*.1))<1e-8);
 const late={...h,air:.015,verticalSpeed:-3,pendingTrick:null};
 assert.equal(skimAction(late,"shuvit",point,.1,surface).pendingTrick,null);
});
test("planing footprint cannot pierce a steep face when its tilt is clamped",()=>{
 const p={x:0,z:0},floor=(q:typeof p)=>q.z*2;
 const c=skimBoardContact(p,{x:0,z:1},0,-10,floor);
 assert.ok(c.centerY-Math.tan(c.pitch)*.82>=c.noseY-1e-8);
 assert.ok(c.centerY+Math.tan(c.pitch)*.82>=c.tailY-1e-8);
});
test("continuous surf uses the physical elevation, local alpha, bounded draws and full disposal",()=>{
 const scene=new THREE.Scene();const surf=createWorldSkimSurf(scene,0,()=>-5);
 surf.update(1.25);
 const skin=surf.root.getObjectByName("skim-shared-water-skin") as THREE.Mesh;
 assert.ok(skin);assert.equal(surf.root.children.length,7);
 const p=skin.geometry.getAttribute("position"),c=skin.geometry.getAttribute("color");
 let min=1,max=0;
 for(let i=0;i<p.count;i+=41){
  const point={x:p.getX(i),z:p.getZ(i)};
  if(skimOffshore(point)>0)assert.ok(Math.abs(p.getY(i)-skimWaterHeight(point,1.25,0))<.0001);
  min=Math.min(min,c.getW(i));max=Math.max(max,c.getW(i));
 }
 assert.equal(min,0);assert.ok(max>.3&&max<.6,"no opaque full-width ribbons");
 const before=p.getY(2000);surf.update(2,false);
 assert.equal(surf.root.visible,false);assert.equal(p.getY(2000),before,"culled surf does no vertex work");
 surf.dispose();assert.equal(scene.children.length,0);
});
