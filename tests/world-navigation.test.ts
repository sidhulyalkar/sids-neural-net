import { test } from "node:test";
import assert from "node:assert/strict";
import {
  constrainMove,
  distance,
  MEMORY_POINTS,
  nearbyDiscovery,
  REGIONS,
  SECRET,
  terrainHeight,
  WORLD_BOUNDS,
} from "../lib/world/model";
import { getWorldContent } from "../lib/world/content";
import { existsSync } from "node:fs";
import { arcadeGames } from "../src/data/arcadeGames";
import graph from "../data/generated/neural-graph.json";
import { isProfessionalProject } from "../lib/graph/professional-projects";
import { NeuralGraphSchema } from "../lib/data/schemas";

test("every jump lands within its own discoverable region on finite terrain", () => {
  for (const r of REGIONS) {
    const landing = { x: r.point.x, z: r.point.z + 3 };
    assert.equal(nearbyDiscovery(landing), r.id);
    assert.ok(Number.isFinite(terrainHeight(landing.x, landing.z)));
  }
});
test("viewpoints and hidden discovery take precedence over surrounding region", () => {
  for (const m of MEMORY_POINTS) assert.equal(nearbyDiscovery(m.point), m.id);
  assert.equal(nearbyDiscovery(SECRET), "secret");
  assert.equal(nearbyDiscovery({ x: 40, z: 35 }), null);
});
test("movement stays on land and resolves trunk collision including a zero-distance contact", () => {
  assert.deepEqual(constrainMove({ x: 0, z: 0 }, { x: -100, z: 100 }, []), {
    x: -34,
    z: WORLD_BOUNDS.maxZ,
  });
  const obstacle = { x: 0, z: 0, radius: 2 };
  const contact = constrainMove({ x: 4, z: 0 }, { x: 0, z: 0 }, [obstacle]);
  assert.ok(distance(contact, obstacle) >= 2.45 - 1e-8);
  assert.ok(Number.isFinite(contact.x) && Number.isFinite(contact.z));
});
test("world content resolves to six real project pages and three local photos", () => {
  const content = getWorldContent();
  assert.equal(content.projects.length, 6);
  const nodes = NeuralGraphSchema.parse(graph).nodes;
  for (const p of content.projects) {
    assert.ok(
      nodes.some(
        (n) => `/projects/${n.slug}` === p.href && isProfessionalProject(n),
      ),
      p.href,
    );
    assert.ok(p.summary.length > 0);
  }
  assert.equal(content.photos.length, 3);
  for (const photo of content.photos)
    assert.ok(existsSync(`public${photo.src}`), photo.src);
});

test("swept movement cannot tunnel through a trunk even when the endpoint is clear", () => {
  const trunk = { x: 0, z: 0, radius: 2 };
  const result = constrainMove({ x: -10, z: 0 }, { x: 10, z: 0 }, [trunk]);
  assert.ok(result.x <= -2.45);
  assert.ok(distance(result, trunk) >= 2.45);
});

test("oblique movement slides and boundary trunks never push the player off land", () => {
  const trunk = { x: 0, z: 0, radius: 2 };
  const start = { x: -4, z: 1 };
  const result = constrainMove(start, { x: 4, z: 1 }, [trunk]);
  assert.ok(result.x > start.x && result.z > start.z);
  assert.ok(distance(result, trunk) >= 2.45 - 1e-8);
  const edge = { x: -34, z: 0, radius: 2 };
  const boundary = constrainMove({ x: -30, z: 0 }, { x: -50, z: 0 }, [edge]);
  assert.ok(boundary.x >= -34 && distance(boundary, edge) >= 2.45 - 1e-8);
});

test("successive corner movements remain outside all trunks and within map bounds", () => {
  const trunks = [{ x: 0, z: 0, radius: 2 }, { x: 4, z: 0, radius: 2 }];
  let point = { x: 2, z: -8 };
  for (let i = 0; i < 100; i++) {
    point = constrainMove(point, { x: point.x + 0.03, z: point.z + 0.25 }, trunks);
    for (const trunk of trunks) assert.ok(distance(point, trunk) >= 2.45 - 1e-8);
    assert.ok(point.x >= -34 && point.x <= 42 && point.z >= -40 && point.z <= 36);
  }
});


test("arcade cavern exposes the same playable games as the established arcade", () => {
  const games = getWorldContent().games;
  assert.deepEqual(games.map(g => g.href), arcadeGames.filter(g => g.status === "playable").map(g => `/arcade/${g.slug}`));
  assert.equal(games[0].title, "Stretchicorn");
  assert.equal(REGIONS.find(r => r.id === "cavern")?.href, "/arcade");
});
