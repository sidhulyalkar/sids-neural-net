import test from "node:test";
import assert from "node:assert/strict";
import {ARCADE_CAVE,isWater,terrainHeight,caveHalfWidth,
 caveObstacles,regionLanding,arcadeCaveFloorHeight} from "../lib/world/model";
import {stepTravel,type Travel} from "../lib/world/activities";
import {ARCADE_GATE,ARCADE_TRAIL_MARKERS,arcadeTrailStage,
 arcadeTrailHint,arcadeTrailFooting,arcadeEntranceCameraPose} from "../lib/world/arcadeWayfinding";

test("Granite Ridge arcade beacons lead towards the real reachable cave mouth",()=>{
 assert.equal(ARCADE_TRAIL_MARKERS.length,4);
 assert.ok(ARCADE_TRAIL_MARKERS[0].point.z>ARCADE_TRAIL_MARKERS[1].point.z);
 const ridge=regionLanding("mountain");
 assert.ok(Math.hypot(ridge.x-ARCADE_TRAIL_MARKERS[0].point.x,
  ridge.z-ARCADE_TRAIL_MARKERS[0].point.z)<14);
 assert.equal(ARCADE_GATE.beacon.x,ARCADE_CAVE.entrance.x);
 assert.ok(ARCADE_GATE.beacon.z<ARCADE_CAVE.entrance.z);
 for(const mark of ARCADE_TRAIL_MARKERS){
  assert.ok(mark.height>=2.3&&mark.height<=5.0);
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
 assert.equal(arcadeTrailStage(ridge,"surface"),"trail",
  "Granite Ridge arrivals should see the first amber trail cue");
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
 assert.ok(solids.length>=75,
  "existing cave sidewalls and baffle must remain collision-authoritative");
 assert.ok(!solids.some(p=>
  Math.abs(p.z-ARCADE_CAVE.approach.z)<.5&&
  Math.abs(p.x-ARCADE_CAVE.approach.x)<1.5));
});

test("real lateral cave navigation is open beyond the rock baffle",()=>{
 let travel:Travel={
  point:{x:18.57,z:-66.13},heading:{x:0,z:1},speed:0,
 };
 for(let i=0;i<100;i++)
  travel=stepTravel(travel,{x:-1,z:0},.05,"run",
   caveObstacles(),false,null,0,arcadeCaveFloorHeight);
 assert.ok(travel.point.x<16.05,
  "walking left from east chamber niche must reach center game wall");
 assert.ok(travel.point.z< -65.5&&travel.point.z> -66.8,
  "sideways motion must not teleport up the tunnel");
});

test("outside portal camera frames the sign from ABOVE the actual approach",()=>{
 const pose=arcadeEntranceCameraPose();
 assert.ok(pose.position.z<ARCADE_CAVE.approach.z,
  "the lens belongs downhill of the visitor, in open air");
 assert.ok(ARCADE_CAVE.approach.z-pose.position.z>4.5&&
  ARCADE_CAVE.approach.z-pose.position.z<9.5,
  "the facade should remain in view from a useful third-person camera distance");
 assert.ok(pose.position.y>terrainHeight(pose.position.x,pose.position.z)+1.7);
 assert.ok(pose.look.z<ARCADE_CAVE.entrance.z,
  "the visible focal point must stop outside solid mountain roof");
 assert.ok(pose.look.y>arcadeCaveFloorHeight(ARCADE_CAVE.entrance)+3);
 // Sample the finite approach heightfield, not its raw mountain roof.
 // A camera sightline through the actual terrain should never hide the sign.
 for(let i=1;i<20;i++){
  const t=i/20;
  const z=pose.position.z+
   (pose.look.z-pose.position.z)*t;
  const y=pose.position.y+
   (pose.look.y-pose.position.y)*t;
  assert.ok(y>terrainHeight(pose.position.x,z)+.20,
   "portal sightline intersects mountain at z="+z.toFixed(2));
 }
});
