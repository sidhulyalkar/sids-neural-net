import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {createSouthChannelLife,SOUTH_REEF_COUNTS} from "../components/world/worldSouthChannelLife";
import {stepSwim} from "../lib/world/activities";
import {
 SEA_SURFACE, SOUTH_CHANNEL_MIN_Z, WORLD_BOUNDS,
 seaFloorHeight, southernChannelFloorHeight, worldFloorHeight,
 maxDiveDepth, waterZone, constrainMove,
} from "../lib/world/model";
import {RAY_PASSAGE,rayPassageDepth} from "../lib/world/rayPassage";

test("southern offshore reef supports real swimming past original island extent",()=>{
 const start={point:{x:65,z:-93},heading:{x:0,z:-1},speed:4.6};
 assert.equal(waterZone(start.point),"lagoon");
 let swim=start;
 for(let i=0;i<95;i++) swim=stepSwim(swim,{x:0,z:-1},.12);
 assert.ok(swim.point.z<-125,`failed to swim offshore: ${swim.point.z}`);
 assert.equal(waterZone(swim.point),"south-channel");
 assert.equal(constrainMove(start.point,{x:65,z:-127},[]).z,WORLD_BOUNDS.minZ);
 // Swim back toward shore; the existing original lagoon remains accessible.
 for(let i=0;i<95;i++)swim=stepSwim(swim,{x:0,z:1},.12);
 assert.ok(swim.point.z>-100);
 assert.equal(waterZone({x:65,z:-93}),"lagoon");
 assert.equal(waterZone({x:-42,z:-93}),"kelp");
 assert.equal(WORLD_BOUNDS.minZ,-96);
 assert.equal(SOUTH_CHANNEL_MIN_Z,-166);
});

test("offshore seabed joins existing terrain without tears and retains cave/mountain heights",()=>{
 for(const x of [-89,-65,-40,-20,0,17,39,60,82,93]) {
   const edge=worldFloorHeight(x,WORLD_BOUNDS.minZ);
   assert.ok(Math.abs(edge-southernChannelFloorHeight(x,WORLD_BOUNDS.minZ))<1e-9);
   for(const z of [-97,-102,-111,-116,-126,-145,-160,-166]) {
     const floor=seaFloorHeight(x,z);
     assert.ok(Number.isFinite(floor),`bad floor x:${x},z:${z}`);
     assert.ok(Math.abs(floor-southernChannelFloorHeight(x,z))<1e-9);
   }
   const justOutside=southernChannelFloorHeight(x,-96.001);
   assert.ok(Math.abs(justOutside-edge)<.02,`edge seam x=${x}`);
 }
 assert.equal(rayPassageDepth(17,-91),0);
 assert.ok(rayPassageDepth(17,-127)>17);
 assert.equal(waterZone({x:17,z:-127}),"south-channel");
 assert.ok(maxDiveDepth(RAY_PASSAGE)>14);
 assert.ok(maxDiveDepth({x:68,z:10})<=10);
 assert.ok(maxDiveDepth({x:-52,z:10})<=10);
 assert.ok(SEA_SURFACE-seaFloorHeight(17,-127)>19);
});

test("south-channel flora and fauna are batched, close to the seabed and disposable",()=>{
 const parent=new THREE.Group();
 const life=createSouthChannelLife(parent);
 assert.equal(parent.children.length,1);
 assert.equal(life.counts.fish,72);
 assert.equal(life.counts.nudibranchs,25);
 const root=parent.children[0] as THREE.Group;
 assert.equal(root.name,"southern-arch-reef-gardens");
 let draws=0;
 for(const child of root.children){
   assert.ok(child instanceof THREE.InstancedMesh);
   draws++;
   const mesh=child as THREE.InstancedMesh;
   const m=new THREE.Matrix4(),position=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
   for(let i=0;i<mesh.count;i++){
     mesh.getMatrixAt(i,m);
     m.decompose(position,q,scale);
     assert.ok([...position.toArray(),...scale.toArray()].every(Number.isFinite),mesh.name);
     assert.ok(scale.length()>0,mesh.name);
     assert.ok(waterZone({x:position.x,z:position.z})==="south-channel",mesh.name);
     assert.ok(position.y<SEA_SURFACE,mesh.name);
   }
 }
 assert.ok(draws<=8,`southern animals must be instanced: ${draws}`);
 life.update(18);
 life.dispose();
 assert.equal(parent.children.length,0);
});
