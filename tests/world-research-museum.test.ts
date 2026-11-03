import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import graphData from "../data/generated/neural-graph.json";
import {
  PAPER_CAVE,caveObstacles,paperCaveFloorHeight,
  paperCaveHalfWidth,paperCaveInside,paperMuseumRoomIndex,
  nextCaveLayer,supportLayerAtPoint,
} from "../lib/world/model";
import {
  RESEARCH_MUSEUM_SLOTS,RESEARCH_MUSEUM_VIEW,
  museumPaperViewpoint,researchMuseumLayoutValid,
} from "../lib/world/researchMuseum";

test("hidden waterfall research museum has three actual connected stone chambers",()=>{
  assert.equal(PAPER_CAVE.chambers.length,3);
  assert.equal(PAPER_CAVE.thresholds.length,2);
  assert.ok(PAPER_CAVE.backZ<=-56);
  assert.ok(researchMuseumLayoutValid());
  for(const [index,room] of PAPER_CAVE.chambers.entries()){
    const center={x:PAPER_CAVE.x,z:room.centerZ};
    assert.ok(paperCaveInside(center));
    assert.equal(paperMuseumRoomIndex(center),index);
    const floor=paperCaveFloorHeight(center);
    assert.ok(Number.isFinite(floor));
    const half=paperCaveHalfWidth(room.centerZ);
    assert.ok(half>=3.8);
    for(let z=room.centerZ-2;z<=room.centerZ+2;z+=.25){
      const p={x:PAPER_CAVE.x,z};
      assert.ok(paperCaveInside(p),"visitor can travel down center of room");
      assert.ok(Math.abs(paperCaveFloorHeight(p)-floor)<1.5,
        "continuous floor cannot introduce giant seam at room boundary");
    }
  }
  const colliders=caveObstacles();
  for(const z of PAPER_CAVE.thresholds){
    const center={x:PAPER_CAVE.x,z};
    assert.ok(paperCaveInside(center),"the threshold must be walkable");
    assert.ok(colliders.every(c=>
      Math.hypot(c.x-center.x,c.z-center.z)>c.radius+.55),
      "no collider should block a central door opening");
  }
  assert.ok(colliders.some(c=>c.z<PAPER_CAVE.backZ-.2),
    "the back wall must prevent escaping underground");
});

test("all eight authentic publication panels have frontal, open-space positions",()=>{
  assert.equal(graphData.nodes.filter(n=>n.type==="publication").length,8);
  assert.equal(RESEARCH_MUSEUM_SLOTS.length,8);
  assert.deepEqual(RESEARCH_MUSEUM_SLOTS.map(s=>s.roomIndex),
    [0,0,1,1,2,2,2,2]);
  for(const [i,slot] of RESEARCH_MUSEUM_SLOTS.entries()){
    assert.equal(slot.index,i);
    const view=museumPaperViewpoint(slot);
    const radius=REESEARCH_MUSEUM_VIEW_CLEAR_RADIUS();
    assert.ok(paperCaveInside(view));
    assert.ok(Math.abs(view.x-PAPER_CAVE.x)+radius<
      paperCaveHalfWidth(view.z)-.46);
    assert.ok(Math.hypot(view.x-slot.x,view.z-slot.z)-
      RESEARCH_MUSEUM_VIEW.standingDistance<1e-8);
    assert.ok(Math.abs(view.z-slot.z)>1||
      Math.abs(view.x-slot.x)>1);
    assert.ok(!PAPER_CAVE.thresholds.some(z=>Math.abs(z-slot.z)<1.4),
      "doorway wall must not be covered by a paper");
  }
});
function REESEARCH_MUSEUM_VIEW_CLEAR_RADIUS(){
  return RESEARCH_MUSEUM_VIEW.clearRadius;
}

test("waterfall roof, portals and publication links remain separate from the new rooms",()=>{
  const scene=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  const gallery=readFileSync(new URL("../components/world/worldPaperGallery.ts",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  assert.match(scene,/waterfallCrownRings\(\)/);
  assert.match(scene,/PAPER_CAVE\.thresholds/);
  assert.match(scene,/const paperRings=Array\.from/);
  assert.match(scene,/w=paperCaveHalfWidth\(z\)\+\.08/,
    "floor must extend underneath the wall footprint, not leave a light slit");
  assert.match(scene,/const skirtingRings=paperRings\.map/,
    "stone baseboards cover the floor-wall join without overlapping floors");
  assert.match(scene,/y\+\.27,z/,
    "raised skirting is not coplanar with the underlying foundation");
  assert.match(scene,/Math\.abs\(PAPER_CAVE\.backZ-PAPER_CAVE\.z\)/);
  assert.match(scene,/canvas\.dataset\.paperGalleryRooms/);
  assert.match(scene,/canvas\.dataset\.paperMuseumRoom/);
  assert.match(scene,/paperGallery\.targets/);
  assert.match(scene,/paperGallery\.dispose\(\)/);
  assert.match(scene,/caveLayer==="paper"&&paperCaveInside\(player\)\?62:47/);
  assert.match(gallery,/papers\.slice\(0,8\)/);
  assert.match(gallery,/paper\.title/);
  assert.match(gallery,/gallery-paper:/);
  assert.match(gallery,/RESEARCH_MUSEUM_SLOTS\[index\]/);
  assert.match(gallery,/museum-ornate-gold/);
  assert.match(gallery,/targets\.push\(art\)/);
  assert.match(ui,/galleryDestination:target/);
  assert.equal(nextCaveLayer("paper",{x:-20,z:-30.6},{x:-20,z:-31.3},0),"paper");
  assert.equal(supportLayerAtPoint("paper",{x:-20,z:-40},0),"paper");
});
