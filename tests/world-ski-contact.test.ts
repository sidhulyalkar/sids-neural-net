import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {fitSkiContact,skiFollowYaw,skiCameraHeight,constrainSkiCamera} from "../components/world/worldSkiContact";
import {terrainHeight} from "../lib/world/model";

test("both rigid skis contact their soles on inclined planes without height double counting",()=>{
 for(const dx of [-2,0,2])for(const dz of [-1,0,1])for(const side of [-1,1]){
  const h=({x,z}:{x:number;z:number})=>dx*x+dz*z;
  const pose=fitSkiContact({x:7,z:-50},{x:.6,z:.8},side,h);
  for(const along of [-1.275,0,1.275])for(const w of [-.095,.095]){
   const v=new THREE.Vector3(w,-.0125,along).applyQuaternion(pose.rotation).add(pose.position);
   assert.ok(Math.abs(v.y-h(v)-.008)<1e-8);
  }
 }
});

test("curved snow supports each ski on both walls and lips without sole penetration",()=>{
 const h=({x,z}:{x:number;z:number})=>terrainHeight(x,z);
 for(const z of [-60,-57,-50,-38,-34])for(const x of [.6,1,3,7,11,13,13.4]){
  for(const heading of [{x:0,z:1},{x:1,z:0},{x:-1,z:0}])for(const side of [-1,1]){
   const p=fitSkiContact({x,z},heading,side,h);
   let min=Infinity;
   for(let j=0;j<=64;j++)for(const w of [-.095,0,.095]){
    const v=new THREE.Vector3(w,-.0125,-1.275+2.55*j/64).applyQuaternion(p.rotation).add(p.position);
    const clearance=v.y-h(v);
    assert.ok(clearance>-.025,JSON.stringify({x,z,side,clearance}));
    min=Math.min(min,clearance);
   }
   assert.ok(min<.03,"at least one physical support point per rigid ski");
   assert.ok(p.up.y>0);
  }
 }
});

test("ski follow rotates smoothly through the angle wrap and clears steep camera sightlines",()=>{
 const target={x:.1,z:1};
 for(const fps of [20,30,60,120]){
  let yaw=-3.1;
  for(let i=0;i<fps;i++)yaw=skiFollowYaw(yaw,target,1/fps);
  assert.ok(Math.abs(yaw+Math.PI)<.14);
 }
 const look={x:0,y:2,z:0},camera={x:0,y:3,z:7};
 const h=({z}:{z:number})=>z>2&&z<4?4:0;
 const y=skiCameraHeight(look,camera,h);
 for(let i=1;i<=24;i++){
  const t=i/24;
  assert.ok(look.y+(y-look.y)*t>=h({z:7*t})+.35-1e-9);
 }
});

test("ski contact agrees with the rendered full-resolution snow triangles",async()=>{
 const {WORLD_BOUNDS:b,worldFloorHeight}=await import('../lib/world/model');
 const {refineMountainSnow}=await import('../components/world/worldMountainHalfpipe');
 const grid=new THREE.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,142,132);
 grid.rotateX(-Math.PI/2);grid.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
 const p=grid.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,worldFloorHeight(p.getX(i),p.getZ(i)));
 grid.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.count*3),3));
 refineMountainSnow(grid);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(grid,material);
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
 let maxError=0;
 for(const z of [-60,-57,-50,-38,-34])for(const x of [.6,1,3,7,11,13,13.4]){
  ray.ray.origin.set(x,100,z);
  const hit=ray.intersectObject(mesh,false)[0];
  assert.ok(hit,'snow must have no hole beneath the skis');
  const error=Math.abs(hit.point.y-terrainHeight(x,z));
  maxError=Math.max(maxError,error);
 }
 assert.ok(maxError<.08,`rendered/physical surface discrepancy ${maxError}`);
 grid.dispose();material.dispose();
});


test("the follow boom shortens at both outer lips instead of climbing into the sky",()=>{
 const height=({x,z}:{x:number;z:number})=>terrainHeight(x,z);
 for(const x of [-.33,1.2,12.64,14.33]){
  const look=new THREE.Vector3(x,terrainHeight(x,-47.9)+1.2,-47.9);
  const camera=new THREE.Vector3(x<7?x+7:x-7,look.y+3,-47.9);
  constrainSkiCamera(look,camera,height);
  assert.ok(camera.y<=look.y+8.001);
  for(let i=1;i<=24;i++){
   const p=look.clone().lerp(camera,i/24);
   assert.ok(p.y>=height(p)+.35-1e-8);
  }
 }
});
