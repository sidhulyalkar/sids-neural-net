import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  BALANCE_BEAMS,ROCK_GARDENS,beamRiseAt,beamLocal,
  beamSupportHeight,rockGardenHeightOffset,rockGardenStones,
  technicalFeatureClearance,
} from "../lib/world/technicalFeatures";
import {createTechnicalGeometry} from "../components/world/worldTechnicalGeometry";
import {terrainHeight,isWater,ARCADE_CAVE,PAPER_CAVE,distance} from "../lib/world/model";
import {groundHeight,stepTravel} from "../lib/world/activities";

test("three authored rock gardens are physical microterrain, not detached decorative rocks",()=>{
  assert.equal(ROCK_GARDENS.length,3);
  const controls=new Set<string>();
  for(const g of ROCK_GARDENS){
    assert.ok(!isWater(g.center));
    assert.ok(distance(g.center,ARCADE_CAVE.entrance)>12);
    assert.ok(distance(g.center,PAPER_CAVE)>12);
    const stones=rockGardenStones(g);
    assert.equal(stones.length,11);
    assert.deepEqual(rockGardenStones(g),stones);
    for(const stone of stones){
      assert.ok(stone.height>0&&stone.height<.40);
      assert.ok(Number.isFinite(terrainHeight(stone.x,stone.z)));
      assert.ok(rockGardenHeightOffset(stone)>0.05);
      assert.ok(technicalFeatureClearance(stone));
    }
    controls.add(g.zone);
    const centerSlope=Math.abs(terrainHeight(g.center.x+.2,g.center.z)-
      terrainHeight(g.center.x-.2,g.center.z));
    assert.ok(centerSlope<.28,`${g.id}: route is not an unrideable ledge`);
  }
  assert.ok(controls.has("desert")&&controls.has("redwood"));
  assert.equal(rockGardenHeightOffset({x:-42,z:40}),0);
});

test("three low beam support surfaces are real, taper at both ends and release outside width",()=>{
  assert.equal(BALANCE_BEAMS.length,3);
  for(const beam of BALANCE_BEAMS){
    const length=distance(beam.start,beam.end),unit={
      x:(beam.end.x-beam.start.x)/length,z:(beam.end.z-beam.start.z)/length,
    };
    assert.ok(!isWater(beam.start)&&!isWater(beam.end));
    assert.ok(distance(beam.start,ARCADE_CAVE.entrance)>15);
    for(const fraction of [0,.05,.25,.5,.75,.95,1]){
      const p={x:beam.start.x+unit.x*fraction*length,
        z:beam.start.z+unit.z*fraction*length};
      const rise=beamRiseAt(beam,p);
      assert.ok(rise!==null&&rise>=0&&rise<=beam.rise+.001);
      const base=terrainHeight(p.x,p.z),supported=beamSupportHeight(p,base);
      assert.ok(supported!==null);
      assert.ok(Math.abs(supported!-(base+rise!))<1e-9);
      assert.ok(groundHeight(p)>=base+rise!-1e-9);
      const lateral={x:p.x+unit.z*(beam.halfWidth+.1),
        z:p.z-unit.x*(beam.halfWidth+.1)};
      assert.equal(beamRiseAt(beam,lateral),null,"release beyond edge");
    }
    assert.ok(Math.abs(beamRiseAt(beam,beam.start)!)<1e-9);
    assert.ok(Math.abs(beamRiseAt(beam,beam.end)!)<1e-9);
    const halfway={
      x:(beam.start.x+beam.end.x)/2,z:(beam.start.z+beam.end.z)/2,
    };
    assert.ok(beamLocal(beam,halfway).side<1e-9);
    const from={x:beam.start.x-unit.x*.35,z:beam.start.z-unit.z*.35};
    const to={x:from.x+unit.x*.23,z:from.z+unit.z*.23};
    const drive=stepTravel({point:from,speed:4,heading:unit},unit,.05,
      "bike",[],false,to);
    assert.ok(distance(drive.point,from)>.05,"ride onto a beam without colliding");
  }
});
test("rendered rock and beam mesh is one bounded disposable batch with finite samples",()=>{
  const scene=new THREE.Scene(),scene2=new THREE.Scene();
  const a=createTechnicalGeometry(scene),b=createTechnicalGeometry(scene2);
  assert.equal(scene.children.length,1);
  assert.equal(a.mesh.name,"technical-rock-gardens-and-beams");
  const pos=a.mesh.geometry.getAttribute("position");
  assert.ok(pos.count>4_000&&pos.count<35_000,`vertex budget ${pos.count}`);
  assert.deepEqual(pos.array,b.mesh.geometry.getAttribute("position").array);
  assert.ok(Array.from(pos.array).every(Number.isFinite));
  for(const beam of BALANCE_BEAMS){
    const center={x:(beam.start.x+beam.end.x)/2,
      z:(beam.start.z+beam.end.z)/2};
    const expected=terrainHeight(center.x,center.z)+beamRiseAt(beam,center)!;
    let nearest=Infinity;
    for(let i=0;i<pos.count;i++) {
      const delta=Math.hypot(pos.getX(i)-center.x,pos.getZ(i)-center.z);
      if(delta<.15)nearest=Math.min(nearest,Math.abs(pos.getY(i)-expected));
    }
    assert.ok(nearest<.075,`${beam.id}: deck visibly matches analytic foot support`);
  }
  a.dispose();b.dispose();
  assert.equal(scene.children.length,0);
  assert.equal(scene2.children.length,0);
});
