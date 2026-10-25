import assert from "node:assert/strict";
import test from "node:test";
import {
  SEA_SURFACE, SOUTH_CHANNEL_SHORE_Z, WORLD_BOUNDS,
  terrainHeight, seaFloorHeight, waterZone, maxDiveDepth,
  paperCaveFloorHeight, paperCaveHalfWidth, caveObstacles, constrainMove,
} from "../lib/world/model";
import {waterfallProfile, waterfallCrownRings, waterfallRockWalls} from "../lib/world/hydrology";
import {southCoastDryShore, southCoastEntry, southCoastLanding, SOUTH_ENTRY_SURFACE_Y}
  from "../lib/world/southCoastAccess";
import {stepSwim} from "../lib/world/activities";

/**
 * These contracts intentionally exercise both formerly divergent feature
 * branches through the same merged model. Independent habitat and waterfall
 * suites do not protect against their shared worldRenderer/model edits.
 */
test("merged world keeps original research cave navigable with the new southern ocean",()=>{
  const solids=caveObstacles();
  const galleryRoute=[{x:-20,z:-27},{x:-20,z:-30},{x:-20,z:-34}];
  for(let i=1;i<galleryRoute.length;i++){
    const result=constrainMove(galleryRoute[i-1],galleryRoute[i],solids);
    assert.ok(Math.hypot(result.x-galleryRoute[i].x,result.z-galleryRoute[i].z)<.001,
      "research cave corridor obstructed by merged world features");
    assert.equal(waterZone(result),null,"research cave erroneously became a marine zone");
  }
  assert.ok(paperCaveHalfWidth(-36)>paperCaveHalfWidth(-30));
  for(let z=-35;z<=-32;z+=.5){
    const roof=terrainHeight(-20,z);
    assert.ok(roof-paperCaveFloorHeight({x:-20,z})>4,
      `waterfall roof clearance lost at z=${z}`);
  }
  const falls=waterfallProfile();
  assert.ok(falls.lip.y>falls.floorY+5);
  assert.ok(waterfallCrownRings().length>0);
  assert.ok(waterfallRockWalls().length>0);
});

test("all four oceans remain separated and southern dry beach is still walkable",()=>{
  assert.equal(WORLD_BOUNDS.minZ,SOUTH_CHANNEL_SHORE_Z);
  assert.equal(waterZone({x:-65,z:15}),"kelp");
  assert.equal(waterZone({x:70,z:15}),"lagoon");
  assert.equal(waterZone({x:17,z:-127}),"south-channel");
  assert.equal(waterZone({x:16,z:-71}),null,"arcade should not be treated as water");
  assert.ok(maxDiveDepth({x:17,z:-127})>8);
  assert.ok(seaFloorHeight(17,-127)<SEA_SURFACE-12);
  for(let x=-30;x<=55;x+=5){
    assert.ok(southCoastDryShore(x),`southern entry lost at x=${x}`);
    const land={x,z:SOUTH_CHANNEL_SHORE_Z+.05};
    assert.equal(waterZone(land),null);
    assert.ok(terrainHeight(x,SOUTH_CHANNEL_SHORE_Z)>SEA_SURFACE-.9);
    const entry=southCoastEntry(land,{x:.25,z:-.9},true,true);
    assert.ok(entry,`diagonal shore entry failed at x=${x}`);
    assert.equal(waterZone(entry!),"south-channel");
    assert.equal(southCoastEntry(land,{x:0,z:1},true,true),null);
    assert.equal(southCoastEntry(land,{x:0,z:-1},true,false),null);
    assert.equal(southCoastLanding(land)?.x,x);
    assert.equal(SOUTH_ENTRY_SURFACE_Y,SEA_SURFACE-.42);
  }
});

test("southern swim return remains available without changing land bounds",()=>{
  for(const x of [-28,-7,17,42,55]){
    const entry=southCoastEntry({x,z:SOUTH_CHANNEL_SHORE_Z+.05},
      {x:0,z:-1},true,true);
    assert.ok(entry);
    let travel={point:entry!,heading:{x:0,z:-1},speed:2.4};
    for(let i=0;i<12;i++)travel=stepSwim(travel,{x:0,z:-1},.12);
    assert.equal(waterZone(travel.point),"south-channel");
    for(let i=0;i<45&&waterZone(travel.point)!==null;i++)
      travel=stepSwim(travel,{x:0,z:1},.12);
    assert.equal(waterZone(travel.point),null,`missing surface exit at ${x}`);
    assert.ok(southCoastLanding(travel.point),`no beach landing at ${x}`);
  }
});
