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
import { coastlineX, distance, isWater, SEA_SURFACE, terrainHeight, WORLD_BOUNDS } from "../lib/world/model";

function simulate(mode: Activity, seconds = 2, sprint = false) {
  let state: Travel = { point: { x: 0, z: 20 }, speed: 0, heading: { x: 1, z: 0 } };
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
    state = { point: { x: -10, z: 0 }, speed: 20, heading: { x: 1, z: 0 } };
    const obstacle = { x: 0, z: 0, radius: 2 };
    for (let i = 0; i < 120; i++)
      state = stepTravel(state, { x: 1, z: 0 }, 1 / 30, id, [obstacle]);
    assert.ok(state.point.x <= -2.45 + 1e-5, id);
  }
});

test("ski landing has natural snow and ski mode remains equipped across the world", () => {
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
  const from: Travel = { point: { x: 0, z: 20 }, speed: 13, heading: { x: 1, z: 0 } };
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

test("surface swimming accelerates smoothly and stays inside finite world bounds", () => {
  const z = 10;
  const waterX = coastlineX(z) - 8;
  assert.ok(isWater({ x: waterX, z }));
  let state: Travel = {
    point: { x: waterX, z },
    speed: 0,
    heading: { x: -1, z: 0 },
  };
  for (let i = 0; i < 180; i++)
    state = stepSwim(state, { x: -1, z: 0 }, 1 / 60);
  assert.ok(state.speed > 4);
  assert.ok(state.point.x >= WORLD_BOUNDS.minX);
  for (let i = 0; i < 300; i++)
    state = stepSwim(state, { x: 0, z: 0 }, 1 / 60);
  assert.equal(state.speed, 0);
});

test("equipment contact samples front rear and sides to stay supported on steep terrain", () => {
  const p = activityLanding("ski")!;
  const heading = { x: 0.45, z: -1 };
  const bike = terrainContact(p, heading, 1.05, 0.55);
  const board = terrainContact(p, heading, 1.1, 0.42);
  for (const contact of [bike, board]) {
    assert.ok(Number.isFinite(contact.pitch));
    assert.ok(Number.isFinite(contact.roll));
    assert.ok(contact.support >= terrainHeight(p.x, p.z));
    assert.ok(Math.abs(contact.pitch) < Math.PI / 2);
    assert.ok(Math.abs(contact.roll) < Math.PI / 2);
  }
});

test("fallen logs expose deterministic grind lines and ramps require the right approach", () => {
  const log = FALLEN_LOGS[0];
  const mid = {
    x: (log.a.x + log.b.x) / 2,
    z: (log.a.z + log.b.z) / 2,
  };
  const grind = nearestGrind(mid);
  assert.equal(grind?.log.id, log.id);
  assert.ok(grind && grind.t > 0.4 && grind.t < 0.6);

  for (const ramp of RIDE_RAMPS) {
    const allowed = ramp.modes[0];
    const launch = rampImpulseAt(ramp.point, ramp.heading, allowed, 8);
    assert.equal(launch?.id, ramp.id);
    assert.ok((launch?.impulse ?? 0) > 0);
    assert.equal(rampImpulseAt(ramp.point, { x: -ramp.heading.x, z: -ramp.heading.z }, allowed, 8), null);
    if (!ramp.modes.includes("run")) assert.equal(rampImpulseAt(ramp.point, ramp.heading, "run", 8), null);
  }
});

test("sea surface remains below land gameplay height and water transitions are explicit", () => {
  const z = 0;
  const shore = coastlineX(z);
  assert.ok(!isWater({ x: shore + 1, z }));
  assert.ok(isWater({ x: shore - 1, z }));
  assert.ok(SEA_SURFACE < terrainHeight(shore + 1, z));
});
