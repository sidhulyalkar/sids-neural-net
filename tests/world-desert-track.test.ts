import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  DESERT_TRACK, DESERT_TRACK_LENGTH, DESERT_JUMPS, desertJumpOffset,
  desertTrackCenterline, desertTrackClearance, desertTrackSampleAt,
  desertTrackFrame, desertTrackHeightOffset, desertTrackTreadBlend,
} from "../lib/world/desertTrack";
import { createHabitats } from "../components/world/worldHabitats";
import { groundHeight, rampImpulseAt, rampSurface, RIDE_RAMPS, stepTravel } from "../lib/world/activities";
import { distance, terrainHeight, type Obstacle } from "../lib/world/model";

test("expanded course measures >3x baseline, stays closed and uses extra island area", () => {
  assert.ok(Math.abs(DESERT_TRACK.previousLength - (60+10*Math.PI)) < 1e-8);
  assert.ok(DESERT_TRACK_LENGTH >= 3*DESERT_TRACK.previousLength,
    `expanded course length ${DESERT_TRACK_LENGTH}`);
  assert.ok(DESERT_TRACK_LENGTH >= 300 && DESERT_TRACK_LENGTH <= 330,
    `target 300–330: ${DESERT_TRACK_LENGTH}`);
  const loop = desertTrackCenterline(160);
  assert.ok(distance(loop[0], loop.at(-1)!) < 1e-8, "one closed lap");
  assert.ok(Math.min(...loop.map(p=>p.x)) < 16, "scrub-margin outer return");
  assert.ok(Math.max(...loop.map(p=>p.x)) > 50, "far eastern descent");
  assert.ok(Math.min(...loop.map(p=>p.z)) < -60, "lower shoulder is used");
  assert.ok(Math.max(...loop.map(p=>p.z)) > 8, "north lookout is used");
  let previousTangent = desertTrackFrame(loop[0]).tangent;
  for(const [i,p] of loop.entries()) {
    const frame = desertTrackFrame(p);
    assert.ok(frame.distance < 1e-6, `centerline contact ${i}`);
    assert.equal(desertTrackTreadBlend(p),1);
    assert.ok(desertTrackClearance(p));
    assert.ok(Number.isFinite(terrainHeight(p.x,p.z)));
    if(i) assert.ok(Math.hypot(previousTangent.x-frame.tangent.x,
      previousTangent.z-frame.tangent.z)<0.24, `continuous direction ${i}`);
    previousTangent=frame.tangent;
  }
  for(let i=0;i<300;i++) {
    const point=desertTrackSampleAt(i*DESERT_TRACK_LENGTH/300);
    const frame=desertTrackFrame(point);
    assert.ok(frame.distance < 1e-6,"arc-distance sampler stays on actual geometry");
    assert.ok(Math.abs(frame.s-i*DESERT_TRACK_LENGTH/300)<0.09,
      "s remains monotonic and measurable");
  }
  assert.equal(desertTrackHeightOffset({x:10,z:35}),0);
  assert.equal(desertTrackTreadBlend({x:10,z:35}),0);
  // Historical landmarks and cave remain well off the expanded riding surface.
  for (const p of [{x:16,z:-82},{x:-20,z:-30},{x:44,z:33},{x:58,z:13}])
    assert.ok(!desertTrackClearance(p), `protected destination ${JSON.stringify(p)}`);
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
    while(distance(travel.point,target)>0.11 && attempts++<30) {
      const dir={x:target.x-travel.point.x,z:target.z-travel.point.z};
      const next=stepTravel(travel,dir,0.05,"bike",obstacles,false,target);
      assert.ok(distance(next.point,travel.point)>0.001,
        `bike stalled on earthen feature ${i}`);
      travel=next;
    }
    assert.ok(distance(travel.point,target)<0.15,
      `bike can reach every segment on the centerline ${i}`);
  }
  assert.ok(distance(travel.point,loop[0])<0.7,"ride returns to its start");
  habitats.dispose();
});

test("rock-and-dirt crest launches from ground, not a timber plank", () => {
  assert.equal(DESERT_JUMPS.length, 3);
  for (const feature of DESERT_JUMPS) {
    const jump=RIDE_RAMPS.find(r=>r.id===feature.id)!;
    assert.ok(jump, feature.id);
    assert.equal(rampSurface(jump,jump.point),null);
    assert.ok(Math.abs(groundHeight(jump.point)-terrainHeight(jump.point.x,jump.point.z))<1e-8);
    assert.ok(desertJumpOffset(jump.point)>feature.height*0.65,
      "real sculpted takeoff lip, not invisible launch force");
    const takeoff=rampImpulseAt(jump.point,feature.heading,"bike",7);
    assert.equal(takeoff?.id,feature.id);
    assert.equal(rampImpulseAt(jump.point,{x:-feature.heading.x,z:-feature.heading.z},"bike",8),null);
    assert.equal(rampImpulseAt(jump.point,feature.heading,"run",8),null);
    const landing={x:feature.point.x+feature.heading.x*feature.landing,
      z:feature.point.z+feature.heading.z*feature.landing};
    assert.ok(desertJumpOffset(landing)>0.25,
      "raised landing mound receives the airborne rider");
    for(let along=-4;along<=feature.landing+3;along+=0.25) {
      const a={x:feature.point.x+feature.heading.x*along,z:feature.point.z+feature.heading.z*along};
      const b={x:a.x+feature.heading.x*0.25,z:a.z+feature.heading.z*0.25};
      assert.ok(Math.abs(terrainHeight(a.x,a.z)-terrainHeight(b.x,b.z))<0.25,
        feature.id+" has a continuous, traversable dirt profile");
    }
  }
});
