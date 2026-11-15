import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import { MARINE_SCHOOLS, sampleFish, validateMarineSchools } from "../lib/world/schools";
import { createMarineSchools } from "../components/world/worldSchools";
import { UNDERWATER_TRIDENTS, nearbyUnderwaterTrident, tridentBaseY, tridentReachable } from "../lib/world/artifacts";
import { createWorldTridents,tridentVisualScale,tridentFacingYaw,TRIDENT_VISUAL } from "../components/world/worldTridents";
import { SEA_SURFACE, seaFloorHeight, waterZone } from "../lib/world/model";

test("schooling fish remain in habitat, with three moving formation types",()=>{
  assert.deepEqual(MARINE_SCHOOLS.map(s=>s.form),
    ["ribbon","bait-ball","split-and-reform"]);
  assert.equal(MARINE_SCHOOLS.reduce((n,s)=>n+s.count,0),84);
  assert.deepEqual(validateMarineSchools(),[]);
  for(const s of MARINE_SCHOOLS){
    let changed=0;
    for(let i=0;i<s.count;i++){
      const p=sampleFish(s,i,0),next=sampleFish(s,i,10);
      assert.deepEqual(sampleFish(s,i,10),next,"deterministic sample");
      if(Math.hypot(p.x-next.x,p.z-next.z,p.y-next.y)>.08)changed++;
      assert.equal(waterZone(p),s.zone);
      assert.ok(p.y>=seaFloorHeight(p.x,p.z)+.74);
      assert.ok(p.y<=SEA_SURFACE-.64);
    }
    assert.ok(changed>s.count*.7,`${s.id} forms must animate`);
  }
});
test("school mesh updates are instanced and disposable",()=>{
  const cold=new THREE.Group(),warm=new THREE.Group();
  const schools=createMarineSchools(cold,warm);
  assert.equal(schools.count,84);
  assert.equal(cold.children.length,2);
  assert.equal(warm.children.length,4);
  cold.visible=warm.visible=true;
  schools.update(5);
  assert.ok([...cold.children,...warm.children].every(m=>m instanceof THREE.InstancedMesh));
  schools.dispose();
  assert.equal(cold.children.length,0);
  assert.equal(warm.children.length,0);
});
test("three UCSD-inspired tridents are submerged, reachable and dive-gated",()=>{
  assert.equal(UNDERWATER_TRIDENTS.length,3);
  for(const t of UNDERWATER_TRIDENTS){
    assert.equal(waterZone(t.point),t.zone);
    assert.ok(tridentReachable(t),t.id);
    const y=tridentBaseY(t)+1.0;
    assert.equal(nearbyUnderwaterTrident(t.point,y,"dive")?.id,t.id);
    assert.equal(nearbyUnderwaterTrident(t.point,y,"surface"),null);
    assert.equal(nearbyUnderwaterTrident(t.point,y,"land"),null);
    assert.equal(nearbyUnderwaterTrident(t.point,SEA_SURFACE,"dive"),null);
    assert.equal(nearbyUnderwaterTrident({x:t.point.x+5,z:t.point.z},y,"dive"),null);
    assert.ok(t.href.startsWith("/"));
  }
});
test("larger navy-and-gold trident sculptures remain fully submerged and dive-gated",()=>{
 const kelp=new THREE.Group(),lagoon=new THREE.Group();
 const tridents=createWorldTridents(kelp,lagoon);
 assert.equal(tridents.count,3);
 // Three pooled visual materials, not individual draw calls for each tine.
 assert.equal(kelp.children.length,3);
 assert.equal(lagoon.children.length,3);
 const roots=[kelp,lagoon];
 for(const root of roots){
  for(const obj of root.children){
   assert.ok(obj instanceof THREE.Mesh);
   const attr=(obj as THREE.Mesh).geometry.getAttribute("position");
   const colors=(obj as THREE.Mesh).geometry.getAttribute("color");
   assert.ok(attr.count>100&&colors.count===attr.count);
   for(let i=0;i<attr.count;i++){
    assert.ok(Number.isFinite(attr.getX(i))&&
     Number.isFinite(attr.getY(i))&&Number.isFinite(attr.getZ(i)));
   }
   // No depth-mask, point light, moving flare, or high-cost transparent bloom.
   const material=(obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
   assert.ok(!material.transparent);
   assert.ok(material.vertexColors);
  }
 }
 for(const t of UNDERWATER_TRIDENTS){
  const scale=tridentVisualScale(t);
  assert.ok(scale>=TRIDENT_VISUAL.minScale&&scale<=1,t.id);
  // Approaching the west kelp shore or the eastern reef exposes a broad face,
  // not the narrow 24cm extrusion of the gold-and-navy silhouette.
  const outwardX=Math.sin(tridentFacingYaw(t));
  assert.ok(t.zone==="kelp"?outwardX>.97:outwardX<-.97,
   "the prongs must face players approaching from shore");
  const group=t.zone==="kelp"?kelp:lagoon;
  const rim=group.children.find(c=>c.name===
   (t.zone==="kelp"?"ucsd-inspired-kelp-trident":"ucsd-inspired-lagoon-tridents")) as THREE.Mesh;
  const positions=rim.geometry.getAttribute("position");
  let top=-Infinity,low=Infinity,side=-Infinity,found=0;
  for(let i=0;i<positions.count;i++){
   const dx=positions.getX(i)-t.point.x,dz=positions.getZ(i)-t.point.z;
   if(Math.hypot(dx,dz)>scale*1.15)continue;
   found++;
   const y=positions.getY(i);
   top=Math.max(top,y);low=Math.min(low,y);
   side=Math.max(side,Math.hypot(dx,dz));
  }
  assert.ok(found>50,"visible prongs must contain real triangles: "+t.id);
  assert.ok(top>tridentBaseY(t)+1.65,
   "three-bladed collectible must be noticeably taller than old 1.9m cones");
  assert.ok(side>scale*.65,
   "the side prongs should be readable from a distance");
  assert.ok(top<=SEA_SURFACE-.59,
   "crown, including bevel, must remain underwater");
  assert.ok(low>=seaFloorHeight(t.point.x,t.point.z)-.02);
  assert.equal(nearbyUnderwaterTrident(t.point,tridentBaseY(t)+1,"dive")?.id,t.id);
 }
 const glow=lagoon.children.find(c=>c.name==="lagoon-trident-gold-inlays") as THREE.Mesh;
 assert.ok((glow.material as THREE.MeshStandardMaterial).emissiveIntensity<=.30,
  "subtle gold accents only, not a giant flashing effect");
 tridents.dispose();
 for(const root of roots)assert.equal(root.children.length,0);
});
