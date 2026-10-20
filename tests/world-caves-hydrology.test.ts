import { test } from "node:test";
import assert from "node:assert/strict";
import { drainagePoints, downstreamPoints, waterfallProfile, waterfallCrownRings } from "../lib/world/hydrology";
import { caveObstacles, constrainMove, mountainSurfaceHeight, paperCaveFloorHeight, paperCaveHalfWidth, paperCaveInside, terrainHeight, worldFloorHeight, SEA_SURFACE } from "../lib/world/model";

test("snowmelt, lip, pool and creek share a continuous downhill profile above terrain", () => {
  const upper = drainagePoints(), lower = downstreamPoints(), profile = waterfallProfile();
  assert.deepEqual(upper.at(-1), profile.lip);
  assert.equal(lower[0].y, profile.pool.y);
  assert.ok(Math.hypot(lower[0].x - profile.pool.x, lower[0].z - profile.pool.z) < 3.7);
  assert.ok(profile.lip.y > profile.floorY + 5);
  assert.ok(Math.abs(lower.at(-1)!.y - SEA_SURFACE) < .05);
  for (const path of [upper, lower]) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      assert.ok(b.y <= a.y, `uphill reach ${i}`);
      for (let t = 0; t <= 1; t += .1) {
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        assert.ok(a.y + (b.y - a.y) * t > worldFloorHeight(x, z), `buried reach ${i}`);
      }
    }
  }
});

test("paper cave widens and descends beneath a continuous waterfall shoulder", () => {
  assert.equal(paperCaveHalfWidth(-30) * 2, 4.6);
  assert.equal(paperCaveHalfWidth(-34) * 2, 8);
  const mouth = paperCaveFloorHeight({ x: -20, z: -30 });
  const chamber = paperCaveFloorHeight({ x: -20, z: -34 });
  assert.ok(chamber < mouth - .8, "archive chamber descends behind the waterfall");
  for (let z = -35; z <= -31; z += .25) {
    const floor = paperCaveFloorHeight({ x: -20, z });
    const roof = terrainHeight(-20, z);
    assert.ok(roof > floor + 4, `paper cave roof clearance at ${z}`);
    assert.ok(Math.abs(roof - mountainSurfaceHeight(-20, z)) < 1e-8);
  }
  assert.equal(paperCaveInside({ x: -17, z: -31.1 }), false);
  assert.equal(paperCaveInside({ x: -17, z: -34 }), true);
});

test("both cave routes permit entry and exit while walls and throat baffle remain solid", () => {
  const solids = caveObstacles();
  const routes = [
    [{ x: 16, z: -86 }, { x: 16, z: -77 }, { x: 18.1, z: -77 }, { x: 18.1, z: -67 }, { x: 16, z: -67 }],
    [{ x: -20, z: -27 }, { x: -20, z: -34 }],
  ];
  for (const route of routes) {
    for (const points of [route, [...route].reverse()]) {
      for (let i = 1; i < points.length; i++) {
        const result = constrainMove(points[i - 1], points[i], solids);
        assert.ok(Math.hypot(result.x - points[i].x, result.z - points[i].z) < .001);
      }
    }
  }
  assert.ok(constrainMove({ x: 14, z: -77 }, { x: 14, z: -71 }, solids).z < -74.5);
  assert.ok(constrainMove({ x: -20, z: -34 }, { x: -20, z: -39 }, solids).z > -36.5);
});


test("melt basin clears the slope and stream has continuous rock support above the archive", () => {
  const upper = drainagePoints();
  const source = upper[0];
  for (let radius = 0; radius <= 2; radius += .2) {
    for (let angle = 0; angle < Math.PI * 2; angle += .15) {
      const ground = terrainHeight(source.x + Math.cos(angle) * radius, source.z + Math.sin(angle) * radius);
      assert.ok(source.y > ground && source.y - ground < .15);
    }
  }
  const crown = waterfallCrownRings();
  assert.equal(crown.at(-1)![3].z, waterfallProfile().lip.z);
  const channel = upper.filter(p => p.z >= -42);
  for (let i = 0; i < crown.length; i++) {
    assert.ok(Math.abs(channel[i].y - crown[i][3].y - .07) < 1e-8);
    assert.equal(crown[i][0].y, terrainHeight(crown[i][0].x, crown[i][0].z));
    assert.equal(crown[i][6].y, terrainHeight(crown[i][6].x, crown[i][6].z));
    assert.ok(crown[i][3].y > waterfallProfile().floorY + 5);
  }
});
