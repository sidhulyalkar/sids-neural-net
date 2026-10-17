import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import { MARINE_SCHOOLS, sampleFish, validateMarineSchools } from "../lib/world/schools";
import { createMarineSchools } from "../components/world/worldSchools";
import { UNDERWATER_TRIDENTS, nearbyUnderwaterTrident, tridentBaseY, tridentReachable } from "../lib/world/artifacts";
import { createWorldTridents } from "../components/world/worldTridents";
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
test("tridents batch into one mesh per marine zone with finite coordinates",()=>{
  const kelp=new THREE.Group(),lagoon=new THREE.Group();
  const tridents=createWorldTridents(kelp,lagoon);
  assert.equal(tridents.count,3);
  assert.equal(kelp.children.length,1);
  assert.equal(lagoon.children.length,1);
  for(const obj of [...kelp.children,...lagoon.children]){
    const geo=(obj as THREE.Mesh).geometry;
    const attr=geo.getAttribute("position");
    assert.ok(attr.count>100);
    for(let i=0;i<attr.count;i++)
      assert.ok(Number.isFinite(attr.getX(i))&&Number.isFinite(attr.getY(i))&&Number.isFinite(attr.getZ(i)));
  }
  tridents.dispose();
  assert.equal(kelp.children.length,0);
  assert.equal(lagoon.children.length,0);
});
