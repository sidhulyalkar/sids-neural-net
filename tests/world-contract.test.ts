import { test } from "node:test";
import assert from "node:assert/strict";
import { biomeAt } from "../lib/world/biomes";
import {
  terrainHeight,
  mountainSurfaceHeight,
  arcadeCaveFloorHeight,
  paperCaveFloorHeight,
  arcadeInside,
  paperCaveInside,
  nearbyDiscovery,
} from "../lib/world/model";
import {
  initialChaseState,
  stepChase,
  steerShastaVelocity,
} from "../lib/world/shastaMotion";
import {
  RIDE_RAMPS,
  FALLEN_LOGS,
  nearestGrind,
  rampImpulseAt,
  sportClearance,
} from "../lib/world/activities";
import { drainagePoints } from "../lib/world/hydrology";
test("biome weights are deterministic, normalized and continuous through three-way junctions", () => {
  for (let x = -30; x < 55; x += 3)
    for (let z = -85; z < 50; z += 3) {
      const a = biomeAt({ x, z }),
        b = biomeAt({ x: x + 0.01, z });
      assert.deepEqual(a, biomeAt({ x, z }));
      assert.ok(
        Math.abs(Object.values(a.weights).reduce((a, b) => a + b, 0) - 1) <
          1e-6,
      );
      for (const k of Object.keys(a.weights) as (keyof typeof a.weights)[]) {
        assert.ok(a.weights[k] >= 0 && Number.isFinite(a.weights[k]));
        assert.ok(Math.abs(a.weights[k] - b.weights[k]) < 0.02);
      }
    }
});
test("cave floors stay separate from continuous walkable roof terrain", () => {
  const deepFloor = arcadeCaveFloorHeight({ x: 16, z: -76 });
  for (let z = -76; z < -64; z += 0.25) {
    assert.ok(Math.abs(arcadeCaveFloorHeight({ x: 16, z }) - deepFloor) < 0.02);
    assert.ok(terrainHeight(16, z) > deepFloor + 7);
    assert.ok(Math.abs(terrainHeight(16, z) - mountainSurfaceHeight(16, z)) < 1e-8);
  }
  assert.ok(terrainHeight(-20, -33) > paperCaveFloorHeight({ x: -20, z: -33 }) + 4);
  assert.equal(arcadeInside({ x: 16, z: -83 }), false);
  assert.equal(arcadeInside({ x: 16, z: -69 }), true);
  assert.equal(paperCaveInside({ x: -20, z: -28 }), false);
  assert.equal(nearbyDiscovery({ x: -20, z: -33 }), "paper-archive");
});
test("snowmelt upstream path descends monotonically", () => {
  const p = drainagePoints();
  for (let i = 1; i < p.length; i++) assert.ok(p[i].y < p[i - 1].y);
});
test("sport features reserve runouts and scenery logs cannot acquire grinds", () => {
  assert.ok(RIDE_RAMPS.length >= 10);
  assert.ok(FALLEN_LOGS.length >= 12);
  for (const r of RIDE_RAMPS) {
    assert.ok(sportClearance(r.point));
    assert.equal(rampImpulseAt(r.point, r.heading, r.modes[0], 8)?.id, r.id);
  }
  for (const log of FALLEN_LOGS.filter((l) => l.role === "scenery"))
    assert.notEqual(
      nearestGrind({ x: (log.a.x + log.b.x) / 2, z: (log.a.z + log.b.z) / 2 })
        ?.log.id,
      log.id,
    );
});
test("Shasta commits to return after timed chase despite fresh prey, then waits before chasing", () => {
  const player = { x: 0, z: 0 },
    dog = { x: 3, z: 0 },
    prey = [{ x: 6, z: 0 }];
  let s = stepChase(initialChaseState(), 0, dog, player, prey, true);
  assert.equal(s.mode, "chase");
  s = stepChase(s, 4, { x: 8, z: 0 }, player, prey, true);
  assert.equal(s.mode, "return");
  s = stepChase(s, 5, { x: 8, z: 0 }, player, [{ x: 9, z: 0 }], true);
  assert.equal(s.mode, "return");
  s = stepChase(s, 6, dog, player, prey, true);
  assert.equal(s.mode, "follow");
  assert.equal(stepChase(s, 7, dog, player, prey, true).mode, "follow");
  assert.equal(stepChase(s, 30, dog, player, prey, true).mode, "chase");
  assert.equal(stepChase(s, 31, dog, player, prey, false).mode, "return");
});
test("Shasta can catch a rider instead of falling permanently behind", () => {
  let velocity = { x: 0, z: 0 };
  for (let i = 0; i < 300; i++)
    velocity = steerShastaVelocity(
      velocity,
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      15,
      1 / 60,
    );
  assert.ok(velocity.x > 15);
});

test("new photo and paper discoveries resolve existing canonical content", async () => {
  const { getWorldContent } = await import("../lib/world/content");
  const content = getWorldContent();
  assert.ok(content.publications.length > 0);
  for (const p of content.publications) {
    assert.equal(p.href, "/publications");
    assert.ok(p.title);
  }
  for (const id of ["desert-ridges", "rainforest-leaves", "lagoon-shore"])
    assert.ok(content.photos.some((p) => p.id === id));
});

test("each ramp has a continuous deck and terrain-supported vehicle contacts", async () => {
  const { rampSurface, groundHeight, terrainContact } = await import(
    "../lib/world/activities"
  );
  for (const r of RIDE_RAMPS) {
    const len = Math.hypot(r.heading.x, r.heading.z),
      f = { x: r.heading.x / len, z: r.heading.z / len };
    for (let t = 0.01; t < 1; t += 0.05) {
      const p = {
        x: r.point.x - f.x * (1 - t) * 3.5,
        z: r.point.z - f.z * (1 - t) * 3.5,
      };
      const y = rampSurface(r, p);
      assert.ok(y !== null);
      assert.ok(groundHeight(p) >= y);
      assert.ok(terrainContact(p, f, 0.5, 0.25).support >= y);
    }
  }
});
