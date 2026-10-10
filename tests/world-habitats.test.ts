import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import { createHabitats } from "../components/world/worldHabitats";
import { biomeAt } from "../lib/world/biomes";
import { coastlineX, eastCoastlineX, type Obstacle } from "../lib/world/model";

test("rainforest gives way to bare beach continuously", () => {
  const z = 36, coast = eastCoastlineX(z);
  const samples = [7, 5, 3, 1, 0].map((offset) => biomeAt({ x: coast - offset, z }));
  for (let i = 1; i < samples.length; i++)
    assert.ok(samples[i].weights.rainforest <= samples[i - 1].weights.rainforest);
  assert.equal(samples.at(-1)!.weights.rainforest, 0);
  assert.equal(samples.at(-1)!.primary, "cold-beach");
});

test("habitat geometry stays deterministic, finite, batched and disposable", () => {
  const scene = new THREE.Scene(), second = new THREE.Scene();
  const obstacles: Obstacle[] = [], repeated: Obstacle[] = [];
  const habitats = createHabitats(scene, obstacles), copy = createHabitats(second, repeated);
  assert.deepEqual(obstacles, repeated);
  assert.ok(scene.children.length <= 14, "bounded shared-material batches");
  let vertices = 0;
  for (const [i, object] of scene.children.entries()) {
    const mesh = object as THREE.Mesh, other = second.children[i] as THREE.Mesh;
    const positions = mesh.geometry.getAttribute("position");
    vertices += positions.count;
    assert.deepEqual(positions.array, other.geometry.getAttribute("position").array);
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    assert.ok(mesh.geometry.boundingSphere!.radius > 0);
  }
  assert.ok(vertices < 320_000, `habitat vertex budget: ${vertices}`);
  const rainforest = scene.children.filter((mesh) => mesh.name.startsWith("rainforest-plants-"));
  assert.equal(rainforest.length, 3, "rainforest canopy uses overlapping persistent spatial bands");
  habitats.update({ x: 1000, z: 1000 });
  assert.ok(scene.children.every((mesh) => mesh.visible), "distance alone must not pop whole habitat batches");
  habitats.update({ x: 43, z: 30 });
  assert.ok(rainforest.every((mesh) => mesh.visible));
  habitats.dispose(); copy.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(second.children.length, 0);
});


test("both shores blend continuously into distinct marine communities", () => {
  for (const [zone, coast, sign] of [["kelp", coastlineX(30), -1], ["lagoon", eastCoastlineX(30), 1]] as const) {
    let previous = biomeAt({ x: coast, z: 30 });
    for (let offshore = 0.01; offshore < 7; offshore += 0.01) {
      const sample = biomeAt({ x: coast + sign * offshore, z: 30 });
      for (const id of Object.keys(sample.weights) as (keyof typeof sample.weights)[])
        assert.ok(Math.abs(sample.weights[id] - previous.weights[id]) < 0.005, `${zone} shoreline ${offshore}`);
      assert.equal(sample.weights[zone === "kelp" ? "lagoon" : "kelp"], 0);
      previous = sample;
    }
    assert.equal(previous.primary, zone);
    assert.equal(previous.weights[zone], 1);
  }
});

test("every authored ecosystem has a dominant habitat and bounded substrate fields", () => {
  const primaries = new Set<string>();
  for (let x = -50; x <= 75; x += 2)
    for (let z = -95; z <= 65; z += 2) {
      const sample = biomeAt({ x, z });
      primaries.add(sample.primary);
      for (const value of Object.values(sample.substrate))
        assert.ok(Number.isFinite(value) && value >= -1e-9 && value <= 1 + 1e-9);
    }
  assert.deepEqual([...primaries].sort(), ["alpine", "redwood", "coastal-scrub", "cold-beach", "kelp", "lagoon", "rainforest", "desert"].sort());
});
