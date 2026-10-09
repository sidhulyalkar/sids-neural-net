import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  DESERT_CLIMB_HOLDS,
  nextHold,
  groundHeight,
  RIDE_RAMPS,
  rampImpulseAt,
  sportClearance,
  stepAirborne,
} from "../lib/world/activities";
import {
  isWater,
  terrainHeight,
  seaFloorHeight,
  SEA_SURFACE,
} from "../lib/world/model";
import { GeometryBatch } from "../components/world/worldGeometry";
import { createReefGarden } from "../components/world/worldReef";

const rampPoint = (r: (typeof RIDE_RAMPS)[number], along: number, side = 0) => {
  const l = Math.hypot(r.heading.x, r.heading.z),
    x = r.heading.x / l,
    z = r.heading.z / l;
  return {
    x: r.point.x + along * x + side * z,
    z: r.point.z + along * z - side * x,
  };
};

test("ramps launch at their visible lip, never beside or halfway up the deck", () => {
  for (const ramp of RIDE_RAMPS) {
    const launch = (along: number, side = 0) =>
      rampImpulseAt(
        rampPoint(ramp, along, side),
        ramp.heading,
        ramp.modes[0],
        12,
      );
    assert.equal(launch(-2), null, ramp.id);
    assert.equal(launch(0, 1.5), null, ramp.id);
    assert.equal(launch(1), null, ramp.id);
    assert.equal(launch(-0.4)?.id, ramp.id);
    assert.equal(launch(0.6)?.id, ramp.id);
    // A maximum-speed ski frame cannot skip the entire takeoff strip.
    assert.ok(0.65 + 0.45 > 15 * 1.45 * 0.05);
  }
});

test("all jump approaches and runouts reserve dry, scenery-free corridors", () => {
  for (const ramp of RIDE_RAMPS) {
    for (let d = -5; d <= 13; d += 0.5) {
      const p = rampPoint(ramp, d);
      assert.ok(sportClearance(p), `${ramp.id} at ${d}`);
      assert.ok(!isWater(p), `${ramp.id} at ${d}`);
    }
  }
  for (const id of [
    "bike-ramp",
    "ski-kicker",
    "bowl-small",
    "bowl-medium",
    "bowl-large",
    "tree-kicker",
  ]) {
    const ramp = RIDE_RAMPS.find((r) => r.id === id)!;
    const p = rampPoint(ramp, 8);
    assert.ok(
      terrainHeight(p.x, p.z) < terrainHeight(ramp.point.x, ramp.point.z),
      `${id} must face downhill`,
    );
  }
});

test("jump approaches and runouts avoid terrain cuts and cliff landings", () => {
  for (const ramp of RIDE_RAMPS) {
    for (const side of [-1.275, 0, 1.275]) {
      for (let d = -5; d < 13; d += 0.25) {
        const a = rampPoint(ramp, d, side);
        const b = rampPoint(ramp, d + 0.25, side);
        const grade = Math.abs(terrainHeight(b.x, b.z) - terrainHeight(a.x, a.z)) / 0.25;
        assert.ok(grade < 1, `${ramp.id} at ${d}, side ${side}: grade ${grade}`);
      }
    }
  }
});

test("geometry batching preserves smooth transformed source normals", () => {
  const source = new THREE.SphereGeometry(1, 8, 5);
  const batch = new GeometryBatch();
  const position = new THREE.Vector3(4, 3, 2),
    scale = new THREE.Vector3(2, 0.5, 1);
  batch.add(source, "#abcabc", position, scale);
  const result = batch.finish();
  const expected = source.toNonIndexed();
  expected.applyMatrix4(
    new THREE.Matrix4().compose(position, new THREE.Quaternion(), scale),
  );
  assert.deepEqual(
    result.getAttribute("normal").array,
    expected.getAttribute("normal").array,
  );
  assert.equal(
    source.getAttribute("position").getY(0),
    1,
    "source remains reusable",
  );
  result.dispose();
  expected.dispose();
  source.dispose();
});

test("reef remains four draws with a submerged, forward-swimming turtle and clean disposal", () => {
  const root = new THREE.Group(),
    reef = createReefGarden(root);
  let meshes = 0,
    triangles = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes++;
      triangles +=
        (object.geometry.index?.count ??
          object.geometry.getAttribute("position").count) / 3;
      assert.ok(
        Array.from(object.geometry.getAttribute("position").array).every(
          Number.isFinite,
        ),
      );
    }
  });
  assert.equal(meshes, 4);
  assert.ok(
    triangles < 25000,
    `${triangles} triangles exceeds local reef budget`,
  );
  const turtle = root.getObjectByName("lagoon-sea-turtle")!;
  for (let t = 0; t < 75; t += 3) {
    reef.update(t);
    const p = turtle.position.clone();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      turtle.quaternion,
    );
    reef.update(t + 0.001);
    const travel = turtle.position.clone().sub(p).setY(0).normalize();
    assert.ok(forward.dot(travel) > 0.999);
    assert.ok(p.y < SEA_SURFACE - 1);
    assert.ok(p.y > seaFloorHeight(p.x, p.z) + 0.5);
  }
  reef.dispose();
  assert.equal(root.children.length, 0);
});


test("airborne motion preserves launch elevation across a deck lip and lands on raised ground", () => {
  const jump = stepAirborne(10.84, 6, 10, 0.05);
  assert.ok(jump.y > 11, "crossing lip must not lose deck height");
  assert.ok(jump.airHeight > 1);
  const descent = stepAirborne(jump.y, jump.verticalSpeed, 6, 0.05);
  assert.ok(descent.y > jump.y, "downhill terrain must not pull rider down");
  const landed = stepAirborne(10.1, -5, 10, 0.05);
  assert.deepEqual(landed, { y: 10, verticalSpeed: 0, airHeight: 0 });
  assert.deepEqual(stepAirborne(12, 6, 10, 1), stepAirborne(12, 6, 10, 0.05));
});


test("Joshua granite ledges form a reachable ascending boulder route", () => {
  let point = { x: 45, z: -18 };
  for (const hold of DESERT_CLIMB_HOLDS) {
    assert.equal(nextHold(point), hold);
    assert.ok(groundHeight(hold) > groundHeight(point) + .5);
    assert.ok(!isWater(hold));
    point = hold;
  }
  assert.equal(nextHold(point), undefined);
});
