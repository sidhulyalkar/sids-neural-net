import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coastlineX,
  constrainMove,
  distance,
  isWater,
  maxDiveDepth,
  MEMORY_POINTS,
  nearbyDiscovery,
  REGIONS,
  SECRET,
  seaFloorHeight,
  SEA_SURFACE,
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
test("movement stays inside the finite world and resolves trunk collision including a zero-distance contact", () => {
  assert.deepEqual(constrainMove({ x: 0, z: 0 }, { x: -1000, z: 1000 }, []), {
    x: WORLD_BOUNDS.minX,
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
  const edge = { x: WORLD_BOUNDS.minX, z: 0, radius: 2 };
  const boundary = constrainMove(
    { x: WORLD_BOUNDS.minX + 4, z: 0 },
    { x: WORLD_BOUNDS.minX - 20, z: 0 },
    [edge],
  );
  assert.ok(boundary.x >= WORLD_BOUNDS.minX && distance(boundary, edge) >= 2.45 - 1e-8);
});

test("successive corner movements remain outside all trunks and within map bounds", () => {
  const trunks = [{ x: 0, z: 0, radius: 2 }, { x: 4, z: 0, radius: 2 }];
  let point = { x: 2, z: -8 };
  for (let i = 0; i < 100; i++) {
    point = constrainMove(point, { x: point.x + 0.03, z: point.z + 0.25 }, trunks);
    for (const trunk of trunks) assert.ok(distance(point, trunk) >= 2.45 - 1e-8);
    assert.ok(
      point.x >= WORLD_BOUNDS.minX &&
      point.x <= WORLD_BOUNDS.maxX &&
      point.z >= WORLD_BOUNDS.minZ &&
      point.z <= WORLD_BOUNDS.maxZ,
    );
  }
});



test("coastline separates land from a finite dive shelf with a safe depth envelope", () => {
  for (const z of [-30, 0, 25]) {
    const shore = coastlineX(z);
    const land = { x: shore + 2, z };
    const water = { x: shore - 10, z };
    assert.equal(isWater(land), false);
    assert.equal(isWater(water), true);
    assert.ok(seaFloorHeight(water.x, water.z) < SEA_SURFACE - 1);
    const depth = maxDiveDepth(water);
    assert.ok(depth > 0 && depth <= 10);
    assert.equal(maxDiveDepth(land), 0);
  }
});

test("arcade cavern exposes the same playable games as the established arcade", () => {
  const games = getWorldContent().games;
  assert.deepEqual(games.map(g => g.href), arcadeGames.filter(g => g.status === "playable").map(g => `/arcade/${g.slug}`));
  assert.equal(games[0].title, "Stretchicorn");
  assert.equal(REGIONS.find(r => r.id === "cavern")?.href, "/arcade");
});


test("the west shelf is swimmable and exposes a finite safe dive envelope", () => {
  const water = { x: -55, z: 10 };
  assert.equal(isWater(water), true);
  const floor = seaFloorHeight(water.x, water.z);
  assert.ok(floor < SEA_SURFACE - 2);
  const depth = maxDiveDepth(water);
  assert.ok(depth > 0);
  assert.ok(SEA_SURFACE - depth > floor);
});

test("expanded alpine region remains finite and meaningfully taller than the grove", () => {
  const mountain = REGIONS.find(r => r.id === "mountain")!;
  assert.ok(terrainHeight(mountain.point.x, mountain.point.z) > terrainHeight(0, 8) + 7);
  assert.ok(mountain.point.z > WORLD_BOUNDS.minZ && mountain.point.z < WORLD_BOUNDS.maxZ);
});
