import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  DESERT_TRACK, desertTrackCenterline, desertTrackClearance,
  desertTrackFrame, desertTrackHeightOffset, desertTrackTreadBlend,
} from "../lib/world/desertTrack";
import { createHabitats } from "../components/world/worldHabitats";
import { groundHeight, rampImpulseAt, rampSurface, RIDE_RAMPS, stepTravel } from "../lib/world/activities";
import { distance, terrainHeight, type Obstacle } from "../lib/world/model";

test("Joshua pump loop is closed, tangent continuous and feathered into the landscape", () => {
  const loop = desertTrackCenterline(24);
  assert.ok(distance(loop[0], loop.at(-1)!) < 1e-8, "full closed return");
  for (const [i,p] of loop.entries()) {
    const sample = desertTrackFrame(p);
    assert.ok(sample.distance < 1e-7, `centerline contact ${i}`);
    assert.equal(desertTrackTreadBlend(p), 1);
    assert.ok(desertTrackClearance(p));
    assert.ok(Number.isFinite(terrainHeight(p.x,p.z)));
    if (i) {
      const prev = desertTrackFrame(loop[i-1]).tangent;
      assert.ok(Math.hypot(prev.x-sample.tangent.x,prev.z-sample.tangent.z) < 0.2,
        `tangent join ${i}`);
    }
  }
  assert.equal(desertTrackHeightOffset({x:10,z:35}),0);
  assert.equal(desertTrackTreadBlend({x:10,z:35}),0);
  for (const z of [DESERT_TRACK.north, DESERT_TRACK.south]) {
    const outside = {x:DESERT_TRACK.cx,z:z+(z< -25 ? -DESERT_TRACK.radius-2.5 : DESERT_TRACK.radius+2.5)};
    const inside = {x:DESERT_TRACK.cx,z:z+(z< -25 ? -DESERT_TRACK.radius+2.5 : DESERT_TRACK.radius-2.5)};
    assert.ok(desertTrackHeightOffset(outside)>desertTrackHeightOffset(inside)+0.2,
      "smooth raised outer berm, passable inner tread");
  }
});

test("bike can traverse the complete dirt flow without hitting decorative obstacles", () => {
  const scene=new THREE.Scene(), obstacles: Obstacle[]=[];
  const habitats=createHabitats(scene,obstacles);
  const loop=desertTrackCenterline(48);
  for(const [i,p] of loop.entries()) {
    for(const obstacle of obstacles)
      assert.ok(distance(p,obstacle)>obstacle.radius+0.32,
        `track blocked by planted object at sample ${i}`);
  }
  let travel={point:loop[0],heading:{x:0,z:-1},speed:5};
  for(const [i,target] of loop.slice(1).entries()) {
    let attempts=0;
    while(distance(travel.point,target)>0.06 && attempts++<15) {
      const dir={x:target.x-travel.point.x,z:target.z-travel.point.z};
      const next=stepTravel(travel,dir,0.05,"bike",obstacles,false,target);
      assert.ok(distance(next.point,travel.point)>0.001,
        `bike stalled on earthen feature ${i}`);
      travel=next;
    }
    assert.ok(distance(travel.point,target)<0.07,
      `bike can reach every segment on the centerline ${i}`);
  }
  assert.ok(distance(travel.point,loop[0])<0.7,"ride returns to its start");
  habitats.dispose();
});

test("rock-and-dirt crest launches from ground, not a timber plank", () => {
  const jump=RIDE_RAMPS.find(r=>r.id==="desert-step")!;
  assert.equal(rampSurface(jump,jump.point),null);
  assert.ok(Math.abs(groundHeight(jump.point)-terrainHeight(jump.point.x,jump.point.z))<1e-8);
  const takeoff=rampImpulseAt(jump.point,{x:0,z:1},"bike",7);
  assert.equal(takeoff?.id,"desert-step");
});
