import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {createSkimWake} from "../components/world/worldSkimWake";

test("foam wake follows rendered water and disappears immediately without wet board contact",()=>{
 const scene=new THREE.Scene(),wake=createSkimWake(scene);
 const sample=p=>.6+.04*Math.sin(p.x*.3+p.z*.2);
 const heading={x:0,z:1};
 const point={x:0,z:45};
 try{
  assert.equal(scene.children.length,2);
  assert.equal(wake.visible,false);
  wake.update(point,heading,7,1,true,sample);
  assert.equal(wake.visible,false,"one frame does not create fake foam");
  wake.update({x:0,z:45.4},heading,7,1.05,true,sample);
  assert.equal(wake.visible,true,"a real planing trail appears behind the board");
  for(const mesh of scene.children){
   assert.ok(mesh instanceof THREE.Mesh);
   assert.equal(mesh.visible,true);
   const coords=mesh.geometry.getAttribute("position");
   for(let i=0;i<coords.count;i++){
    const p={x:coords.getX(i),z:coords.getZ(i)};
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(coords.getY(i)));
    assert.ok(Math.abs(coords.getY(i)-(sample(p)+.035))<.00001,
     "foam must sit on the same sampled water surface as the board");
   }
  }
  // The actual renderer disables riding when skimSurfaceMode is dry.
  // Its wake must then clear both geometry visibility and historic samples.
  wake.update({x:0,z:46},heading,7,1.1,false,sample);
  assert.equal(wake.visible,false);
  assert.ok(scene.children.every(mesh=>!mesh.visible),
   "stale foam must not imply planing over sand");
  wake.update({x:0,z:46.1},heading,7,1.2,true,sample);
  assert.equal(wake.visible,false,"new water contact starts with fresh history");
  wake.update({x:0,z:46.5},heading,7,1.25,true,sample);
  assert.equal(wake.visible,true);
  wake.update({x:0,z:46.5},heading,1,1.3,true,sample);
  assert.equal(wake.visible,false,"stopped board must shed its wake");
 }finally{
  wake.dispose();
 }
 assert.equal(scene.children.length,0,"geometry and material released on World teardown");
});

test("wake resets after source position teleports instead of drawing a kilometer-long ribbon",()=>{
 const scene=new THREE.Scene(),wake=createSkimWake(scene);
 const ground=()=>0;
 try{
  wake.update({x:0,z:45},{x:0,z:1},9,1,true,ground);
  wake.update({x:0,z:46},{x:0,z:1},9,1.05,true,ground);
  assert.equal(wake.visible,true);
  wake.update({x:50,z:70},{x:0,z:1},9,1.1,true,ground);
  assert.equal(wake.visible,false,"instant long-distance transitions cannot trail old water");
  wake.update({x:50,z:71},{x:0,z:1},9,1.15,true,ground);
  assert.equal(wake.visible,true);
  wake.update({x:50,z:71},{x:0,z:1},9,4,true,ground);
  assert.equal(wake.visible,false,"discontinuous clocks reset old foam");
 }finally{wake.dispose();}
});
