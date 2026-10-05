import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITIES,
  activityLanding,
  BOULDER_HOLDS,
  effectiveActivity,
  FALLEN_LOGS,
  groundHeight,
  nearestGrind,
  nextHold,
  onSnow,
  rampImpulseAt,
  RIDE_RAMPS,
  stepSwim,
  stepTravel,
  terrainContact,
  type Activity,
  type Travel,
} from "../lib/world/activities";
import {
  distance,
  isWater,
  maxDiveDepth,
  SEA_SURFACE,
  seaFloorHeight,
  WORLD_BOUNDS,
} from "../lib/world/model";

function simulate(mode: Activity, seconds = 2, sprint = false) {
  let state: Travel = {
    point: { x: 0, z: 20 },
    speed: 0,
    heading: { x: 1, z: 0 },
  };
  for (let i = 0; i < seconds * 60; i++)
    state = stepTravel(state, { x: 1, z: 0 }, 1 / 60, mode, [], sprint);
  return state;
}

test("wheels accelerate beyond running and sprint increases running pace", () => {
  const run = simulate("run");
  assert.ok(simulate("skate").point.x > run.point.x);
  assert.ok(simulate("bike").point.x > simulate("skate").point.x);
  assert.ok(simulate("run", 2, true).point.x > run.point.x);
});

test("all activities brake to rest and never tunnel through a trunk", () => {
  for (const { id } of ACTIVITIES) {
    let state = simulate(id, 0.5);
    for (let i = 0; i < 600; i++)
      state = stepTravel(state, { x: 0, z: 0 }, 1 / 60, id, []);
    assert.equal(state.speed, 0);
    state = {
      point: { x: -10, z: 0 },
      speed: 20,
      heading: { x: 1, z: 0 },
    };
    const obstacle = { x: 0, z: 0, radius: 2 };
    for (let i = 0; i < 120; i++)
      state = stepTravel(state, { x: 1, z: 0 }, 1 / 30, id, [obstacle]);
    assert.ok(state.point.x <= -2.45 + 1e-5, id);
  }
});

test("ski landing is alpine while selected skis remain equipped throughout land exploration", () => {
  const landing = activityLanding("ski")!;
  assert.ok(onSnow(landing));
  assert.equal(effectiveActivity("ski", landing), "ski");
  assert.equal(effectiveActivity("ski", { x: 0, z: 16 }), "ski");
});

test("every authored climbing hold is reachable and advances upward", () => {
  let point = activityLanding("boulder")!;
  for (const hold of BOULDER_HOLDS) {
    assert.deepEqual(nextHold(point), hold);
    assert.ok(groundHeight(hold) > groundHeight(point));
    point = hold;
  }
  assert.equal(nextHold(point), undefined);
});

test("movement clamps long frames, cannot overshoot a click target or leave map", () => {
  const from: Travel = {
    point: { x: 0, z: 20 },
    speed: 13,
    heading: { x: 1, z: 0 },
  };
  const destination = { x: 0.1, z: 20 };
  const next = stepTravel(from, { x: 1, z: 0 }, 10, "bike", [], false, destination);
  assert.ok(distance(next.point, destination) < 1e-8);
  const step = stepTravel(from, { x: 1, z: 0 }, 10, "bike", []);
  assert.ok(distance(step.point, from.point) <= 13 * 0.05);
  const edge = stepTravel(
    { ...from, point: { x: WORLD_BOUNDS.maxX, z: 20 } },
    { x: 1, z: 0 },
    0.05,
    "bike",
    [],
  );
  assert.equal(edge.point.x, WORLD_BOUNDS.maxX);
});

test("swimming keeps bounded wall-clock motion on slow frames", () => {
  const start: Travel = {
    point: { x: -55, z: 10 },
    speed: 4.6,
    heading: { x: -1, z: 0 },
  };
  const next = stepSwim(start, { x: -1, z: 0 }, 10);
  assert.ok(distance(next.point, start.point) <= 4.6 * 0.12 + 1e-8);
  assert.ok(distance(next.point, start.point) > 4.6 * 0.1);
});

test("swimming uses bounded movement and dive depth always leaves clearance above the reef", () => {
  const start = { x: -55, z: 10 };
  assert.ok(isWater(start));
  const available = maxDiveDepth(start);
  assert.ok(available > 1);
  assert.ok(SEA_SURFACE - available >= seaFloorHeight(start.x, start.z) + 1.14);

  let swim: Travel = { point: start, speed: 0, heading: { x: -1, z: 0 } };
  for (let i = 0; i < 120; i++)
    swim = stepSwim(swim, { x: -1, z: 0 }, 1 / 60);
  assert.ok(swim.point.x < start.x);
  assert.ok(swim.speed > 0 && swim.speed <= 4.6);
  assert.ok(swim.point.x >= WORLD_BOUNDS.minX);
});

test("bike, skateboard and skis receive finite pitch/roll contact against uneven ground", () => {
  const contact = terrainContact(
    { x: 8, z: -54 },
    { x: 0.2, z: -1 },
    1.1,
    0.5,
  );
  assert.ok(Number.isFinite(contact.pitch));
  assert.ok(Number.isFinite(contact.roll));
  assert.ok(Number.isFinite(contact.support));
  assert.ok(Math.abs(contact.pitch) < Math.PI / 2);
  assert.ok(Math.abs(contact.roll) < Math.PI / 2);
});

test("fallen logs can be acquired for a grind and ramps only launch compatible moving modes", () => {
  const log = FALLEN_LOGS[0];
  const midpoint = {
    x: (log.a.x + log.b.x) / 2,
    z: (log.a.z + log.b.z) / 2,
  };
  const grind = nearestGrind(midpoint);
  assert.equal(grind?.log.id, log.id);
  assert.ok((grind?.distance ?? Infinity) < 0.01);

  const ramp = RIDE_RAMPS[1];
  const bikeLaunch = rampImpulseAt(ramp.point, ramp.heading, "bike", 8);
  assert.equal(bikeLaunch?.id, ramp.id);
  assert.ok((bikeLaunch?.impulse ?? 0) > ramp.lift);
  assert.equal(rampImpulseAt(ramp.point, ramp.heading, "run", 8), null);
  assert.equal(rampImpulseAt(ramp.point, { x: -ramp.heading.x, z: -ramp.heading.z }, "bike", 8), null);
});
