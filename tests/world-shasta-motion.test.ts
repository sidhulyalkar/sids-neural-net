import test from "node:test";
import assert from "node:assert/strict";
import {
  SHASTA_MOTION,
  gaitBlendForSpeed,
  smoothAngle,
  smoothPoint,
  steerShastaVelocity,
} from "../lib/world/shastaMotion";
import type { Point } from "../lib/world/model";

const speed = (p: Point) => Math.hypot(p.x, p.z);

test("Shasta accelerates and brakes with finite velocity changes", () => {
  const dt = 1 / 60;
  const start = { x: 0, z: 0 };
  const target = { x: 10, z: 0 };
  const first = steerShastaVelocity({ x: 0, z: 0 }, start, target, 6, dt);
  assert.ok(speed(first) <= SHASTA_MOTION.acceleration * dt + 1e-9);

  const moving = { x: 5, z: 0 };
  const stopped = steerShastaVelocity(moving, start, start, 0, dt);
  assert.ok(speed(moving) - speed(stopped) <= SHASTA_MOTION.braking * dt + 1e-9);
  assert.ok(speed(stopped) < speed(moving));
});

test("Shasta arrival steering slows instead of overshooting the follow point", () => {
  const dt = 1 / 60;
  let point: Point = { x: 0, z: 0 };
  let velocity: Point = { x: 0, z: 0 };
  let smoothedTarget: Point = { ...point };
  const target = { x: 8, z: 0 };
  let previousDistance = 8;

  for (let i = 0; i < 360; i++) {
    smoothedTarget = smoothPoint(smoothedTarget, target, dt);
    velocity = steerShastaVelocity(velocity, point, smoothedTarget, 6, dt);
    point = {
      x: point.x + velocity.x * dt,
      z: point.z + velocity.z * dt,
    };
    const distance = Math.hypot(target.x - point.x, target.z - point.z);
    assert.ok(distance < previousDistance + 0.03);
    previousDistance = distance;
  }

  assert.ok(previousDistance < 1.05);
  assert.ok(speed(velocity) < 0.6);
});

test("Shasta steering is stable across common frame rates", () => {
  const simulate = (dt: number) => {
    let point: Point = { x: 0, z: 0 };
    let velocity: Point = { x: 0, z: 0 };
    let smoothedTarget: Point = { ...point };
    const target = { x: 12, z: -3 };
    const frames = Math.round(2.5 / dt);
    for (let i = 0; i < frames; i++) {
      smoothedTarget = smoothPoint(smoothedTarget, target, dt);
      velocity = steerShastaVelocity(velocity, point, smoothedTarget, 7, dt);
      point = {
        x: point.x + velocity.x * dt,
        z: point.z + velocity.z * dt,
      };
    }
    return { point, velocity };
  };

  const sixty = simulate(1 / 60);
  const thirty = simulate(1 / 30);
  assert.ok(Math.hypot(sixty.point.x - thirty.point.x, sixty.point.z - thirty.point.z) < 0.28);
  assert.ok(Math.abs(speed(sixty.velocity) - speed(thirty.velocity)) < 0.22);
});

test("Shasta heading smoothing obeys the angular velocity bound", () => {
  const dt = 1 / 60;
  const next = smoothAngle(0, Math.PI, dt);
  assert.ok(Math.abs(next) <= SHASTA_MOTION.maxTurnRate * dt + 1e-9);
});

test("gait blend transitions continuously from idle into a trot", () => {
  assert.equal(gaitBlendForSpeed(0), 0);
  assert.ok(gaitBlendForSpeed(0.7) > 0);
  assert.ok(gaitBlendForSpeed(1.4) > gaitBlendForSpeed(0.7));
  assert.equal(gaitBlendForSpeed(3), 1);
});
