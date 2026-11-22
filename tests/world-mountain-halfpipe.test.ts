import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  terrainHeight, terrainHeightBeforeHalfpipe, REGIONS,
  MEMORY_POINTS, isWater, worldFloorHeight,
} from "../lib/world/model";
import {
  activityLanding, onSnow, RIDE_RAMPS, rampImpulseAt,
  stepTravel, type Travel,
} from "../lib/world/activities";
import {
  suppressedFaceKicker, mountainHalfpipeApproachClearance,
} from "../lib/world/mountainHalfpipe";
import { shouldLaunchAuthoredSkiJump } from "../lib/world/bigAir";

test("classic iLand restores the uncarved mountain without disturbing other terrain edits", () => {
  for (let x = -35; x <= 64; x += 2.5) {
    for (let z = -95; z <= 63; z += 2) {
      assert.equal(terrainHeight(x,z), terrainHeightBeforeHalfpipe(x,z),
        `unexpected terrain edit at (${x}, ${z})`);
    }
  }
  for (const landmark of [...MEMORY_POINTS.map(p => p.point),...REGIONS.map(r => r.point)]) {
    assert.equal(terrainHeight(landmark.x,landmark.z),
      terrainHeightBeforeHalfpipe(landmark.x,landmark.z));
    assert.ok(Number.isFinite(worldFloorHeight(landmark.x,landmark.z)));
  }
  assert.equal(isWater({x:-60,z:7}),true,"kelp habitat remains accessible");
});

test("all original mountain timber kickers have visible, physical, playable support", () => {
  for (const id of ["ski-kicker","bowl-small","bowl-medium"]) {
    const ramp = RIDE_RAMPS.find(r => r.id===id);
    assert.ok(ramp,`missing original jump ${id}`);
    assert.equal(suppressedFaceKicker(id),false);
    assert.equal(rampImpulseAt(ramp.point,ramp.heading,"ski",8)?.id,id);
  }
  assert.equal(mountainHalfpipeApproachClearance({x:7,z:-47}),false);
  assert.equal(mountainHalfpipeApproachClearance({x:0,z:0}),false);
});

test("classic ski arrival and responsive arcade steering no longer depend on halfpipe", () => {
  const landing = activityLanding("ski");
  assert.deepEqual(landing,{x:8,z:-54});
  assert.ok(landing && onSnow(landing));
  const current:Travel={point:{x:8,z:-54},speed:2,heading:{x:0,z:1}};
  const next=stepTravel(current,{x:1,z:0},1/60,"ski",[],false,null,0,()=>0);
  assert.ok(Math.abs(next.heading.x-1)<1e-9,"WASD steering is direct");
  assert.ok(Math.abs(next.heading.z)<1e-9);
  assert.ok(next.speed>=0);
});

test("new ski solver and halfpipe are never reenabled by stale production flags", () => {
  const source=readFileSync("components/world/worldRenderer.ts","utf8");
  assert.match(source,/const skiV3Enabled\s*=\s*false;/);
  assert.match(source,/const skiPresentation\s*=\s*false;/);
  assert.match(source,/canvas\.dataset\.mountainHalfpipe\s*=\s*"absent"/);
  assert.doesNotMatch(source,/const snowTriangles\s*=\s*refineMountainSnow\(/);
  // Keep the explicit scored Ski Jump path; ordinary movement cannot arm it.
  assert.equal(typeof shouldLaunchAuthoredSkiJump,"function");
});
