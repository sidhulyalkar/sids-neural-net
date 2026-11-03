import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three/src/Three.Core.js";
import { UNDERWATER_TRIDENTS, nearbyUnderwaterTrident, tridentBaseY,
  tridentReachable } from "../lib/world/artifacts";
import { maxDiveDepth, seaFloorHeight, waterZone } from "../lib/world/model";
import { SHRINE_GALLERY, shrineReachable } from "../lib/world/hiddenShrineGallery";
import {
  SHRINE_CORAL_WAYFINDING, SHRINE_CORAL_GUIDES, CORAL_ARROW_COLONIES,
  coralColonyPositions, shrineCoralLayoutValid,
} from "../lib/world/shrineCoralWayfinding";
import { createShrineCoralWayfinding } from "../components/world/worldShrineCoralWayfinding";

test("western trident moves away from the hidden shrine without affecting its discoverability",()=>{
  const trident=UNDERWATER_TRIDENTS.find(t=>t.id==="trident-kelp")!;
  const entrance=SHRINE_GALLERY.entrance;
  const separation=Math.hypot(trident.point.x-entrance.x,
    trident.point.z-entrance.z);
  assert.deepEqual(trident.point,{x:-82,z:-6});
  assert.ok(separation>=18&&separation<=30,
    "trident is a nearby landmark, not an obstacle at the secret entrance");
  assert.equal(waterZone(trident.point),"kelp");
  assert.ok(maxDiveDepth(trident.point)>5);
  assert.ok(tridentReachable(trident));
  assert.equal(nearbyUnderwaterTrident(trident.point,
    tridentBaseY(trident)+1,"dive")?.id,trident.id);
  assert.equal(trident.href,"/about","keep the original interaction/link intact");
  assert.equal(shrineReachable(entrance,maxDiveDepth(entrance)),true,
    "the wooden shrine's actual entry position remains unchanged");
});

test("all four organic coral arrows progressively lead the swimmer to the actual shrine",()=>{
  assert.equal(SHRINE_CORAL_GUIDES.length,4);
  assert.equal(shrineCoralLayoutValid(),true);
  let prev=Infinity;
  for(const guide of SHRINE_CORAL_GUIDES){
    const toEntrance={
      x:SHRINE_GALLERY.entrance.x-guide.point.x,
      z:SHRINE_GALLERY.entrance.z-guide.point.z,
    };
    const range=Math.hypot(toEntrance.x,toEntrance.z);
    assert.ok(range<prev,"the next coral arrow is closer to the shrine");
    prev=range;
    assert.equal(waterZone(guide.point),"kelp");
    assert.ok(maxDiveDepth(guide.point)>=SHRINE_CORAL_WAYFINDING.minSeabedDepth);
    assert.ok(guide.forward.x*toEntrance.x+
      guide.forward.z*toEntrance.z>range*.97,
      "direction of each coral artwork must point toward the hidden opening");
    const shapes=coralColonyPositions(guide);
    assert.equal(shapes.length,CORAL_ARROW_COLONIES.length);
    const tail=shapes[0].point,tip=shapes[6].point;
    const dot=(tip.x-tail.x)*guide.forward.x+
      (tip.z-tail.z)*guide.forward.z;
    assert.ok(dot>1.5*guide.size,"the coral arrow has a clear head direction");
    for(const colony of shapes){
      assert.equal(waterZone(colony.point),"kelp");
      const distanceToEntry=Math.hypot(
        colony.point.x-SHRINE_GALLERY.entrance.x,
        colony.point.z-SHRINE_GALLERY.entrance.z);
      assert.ok(distanceToEntry-colony.radius>=SHRINE_CORAL_WAYFINDING.shrineClearance,
        "coral cannot obstruct the shaft, roof edge or timber entrance");
      assert.equal(colony.seabedY,seaFloorHeight(colony.point.x,colony.point.z),
        "organic coral base must follow the actual uneven seabed");
    }
  }
  assert.ok(prev<6,"a final near-shrine hint makes the secret easier to discover");
});

test("coral sculptures are bounded, opaque, merged and disposable",()=>{
  const root=new THREE.Group();
  const renderer=createShrineCoralWayfinding(root);
  assert.equal(renderer.count,4);
  assert.equal(renderer.colonyCount,36);
  assert.ok(renderer.branchCount>=72&&renderer.branchCount<=108);
  assert.equal(root.children.length,1);
  const trail=root.getObjectByName("shrine-coral-arrow-trail");
  assert.equal(trail,renderer.root);
  assert.equal(trail!.children.length,2,
    "no per-colony draw calls: two merged meshes for living reef art");
  let totalVertices=0;
  for(const item of trail!.children){
    assert.ok(item instanceof THREE.Mesh);
    const m=item as THREE.Mesh;
    const pos=m.geometry.getAttribute("position");
    const colors=m.geometry.getAttribute("color");
    assert.equal(colors.count,pos.count);
    assert.ok((m.material as THREE.MeshStandardMaterial).vertexColors);
    assert.ok(!(m.material as THREE.MeshStandardMaterial).transparent);
    assert.ok(pos.count>100);
    totalVertices+=pos.count;
    for(let k=0;k<pos.count;k++){
      assert.ok(Number.isFinite(pos.getX(k))&&
        Number.isFinite(pos.getY(k))&&Number.isFinite(pos.getZ(k)));
    }
  }
  assert.ok(totalVertices<45_000,"a small landmark should not exhaust mobile geometry");
  renderer.dispose();
  assert.equal(root.children.length,0);
});

test("coral trail shares the existing kelp scene visibility gate and has no artificial collision",()=>{
  const scene=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  const coral=readFileSync(new URL(
    "../components/world/worldShrineCoralWayfinding.ts",import.meta.url),"utf8");
  assert.match(scene,/createShrineCoralWayfinding\(reefRoot\)/);
  assert.match(scene,/shrineCorals\.dispose\(\)/);
  assert.match(scene,/reefRoot\.visible = aquatic !== "land" && currentWaterZone === "kelp"/);
  assert.match(scene,/canvas\.dataset\.shrineCoralArrows/);
  assert.doesNotMatch(coral,/obstacles\.push|collider|raycast\s*=|addEventListener/);
});
