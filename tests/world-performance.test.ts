import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameSampler, QualityController } from "../lib/world/performance";

test("active frame samples report actual percentiles and reset after each window", () => {
  const sampler = new FrameSampler();
  for (let i = 0; i < 99; i++) assert.equal(sampler.add(0.02), null);
  const report = sampler.add(1.02)!;
  assert.equal(report.frames, 100);
  assert.ok(Math.abs(report.fps - 100 / 3) < 1e-8);
  assert.equal(report.p50, 20);
  assert.equal(report.p95, 20);
  assert.equal(sampler.add(0.02), null);
});

test("resume discards partial windows and invalid intervals cannot pollute metrics", () => {
  const sampler = new FrameSampler();
  sampler.add(2);
  sampler.reset();
  for (const invalid of [NaN, Infinity, 0, -1]) assert.equal(sampler.add(invalid), null);
  assert.equal(sampler.add(2), null);
  assert.equal(sampler.add(1)!.frames, 2);
});

test("quality reduction requires sustained slowness, resets on recovery, and respects floor", () => {
  const quality = new QualityController();
  assert.equal(quality.update(20, 1.5), 1.5);
  assert.equal(quality.update(60, 1.5), 1.5);
  assert.equal(quality.update(20, 1.5), 1.5);
  assert.equal(quality.update(20, 1.5), 1.25);
  quality.update(20, 1);
  quality.reset();
  assert.equal(quality.update(20, 1), 1);
  assert.equal(quality.update(20, 1), 0.75);
  for (let i = 0; i < 8; i++) assert.equal(quality.update(20, 0.75), 0.75);
});
