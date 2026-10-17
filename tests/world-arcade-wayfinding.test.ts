import test from "node:test";
import assert from "node:assert/strict";
import {ARCADE_CAVE,isWater,terrainHeight,caveHalfWidth,
 caveObstacles,regionLanding} from "../lib/world/model";
import {ARCADE_GATE,ARCADE_TRAIL_MARKERS,arcadeTrailStage,
 arcadeTrailHint,arcadeTrailFooting} from "../lib/world/arcadeWayfinding";

test("Granite Ridge arcade beacons lead towards the real reachable cave mouth",()=>{
 assert.equal(ARCADE_TRAIL_MARKERS.length,4);
 assert.ok(ARCADE_TRAIL_MARKERS[0].point.z>ARCADE_TRAIL_MARKERS[1].point.z);
 const ridge=regionLanding("mountain");
 assert.ok(Math.hypot(ridge.x-ARCADE_TRAIL_MARKERS[0].point.x,
  ridge.z-ARCADE_TRAIL_MARKERS[0].point.z)<14);
 assert.equal(ARCADE_GATE.beacon.x,ARCADE_CAVE.entrance.x);
 assert.ok(ARCADE_GATE.beacon.z<ARCADE_CAVE.entrance.z);
 for(const mark of ARCADE_TRAIL_MARKERS){
  assert.ok(mark.height>=2.3&&mark.height<=4.1);
  assert.equal(isWater(mark.point),false,"all lanterns should stand on dry ground");
  assert.ok(Number.isFinite(arcadeTrailFooting(mark.point)));
  assert.ok(["trail","entrance"].includes(arcadeTrailStage(mark.point,"surface")));
  assert.match(arcadeTrailHint(mark.point,"surface"),/ARCADE/);
 }
 assert.equal(arcadeTrailStage(ARCADE_CAVE.approach,"surface"),"entrance");
 assert.equal(arcadeTrailStage(ARCADE_CAVE.entrance,"surface"),"entrance");
 assert.equal(arcadeTrailStage(ARCADE_CAVE.entrance,"arcade"),"inside");
 assert.equal(arcadeTrailHint(ARCADE_CAVE.entrance,"arcade"),"");
 assert.equal(arcadeTrailHint({x:0,z:0},"surface"),"");
 assert.equal(arcadeTrailStage(ARCADE_CAVE.entrance,"paper"),"hidden");
});

test("split portal, sign and standing stones never occlude the cave approach",()=>{
 const opening=caveHalfWidth(ARCADE_CAVE.entrance.z);
 for(const side of [ARCADE_GATE.left,ARCADE_GATE.right]){
  assert.ok(Math.abs(side.x-ARCADE_CAVE.entrance.x)>opening+.1,
   "portal basalt must remain beyond usable tunnel width");
  assert.ok(Number.isFinite(terrainHeight(side.x,side.z)));
 }
 assert.ok(ARCADE_GATE.sign.z<ARCADE_CAVE.entrance.z+.3);
 assert.ok(ARCADE_GATE.sign.z>ARCADE_CAVE.approach.z);
 // Wayfinding is *visual only*. Existing underground baffle and stone shell
 // remain the sole cave collision contributors and must not change.
 const solids=caveObstacles();
 assert.equal(solids.length,2*(7+18)+7+19);
 assert.ok(!solids.some(p=>
  Math.abs(p.z-ARCADE_CAVE.approach.z)<.5&&
  Math.abs(p.x-ARCADE_CAVE.approach.x)<1.5));
});
