import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdaptiveFractalTree,
  seededRng,
  type Dimensions,
  type FractalMorphologyId,
  type Vec2,
} from '../lib/home/fractalDendriteV4';

const DESTINATIONS = ['frontier', 'games', 'builds', 'systems', 'contact', 'visuals', 'research', 'papers'];

const CURATED: Array<[FractalMorphologyId, Dimensions]> = [
  ['radial', { width: 1440, height: 900 }],
  ['coral', { width: 1440, height: 900 }],
  ['fan', { width: 1920, height: 1080 }],
  ['apical', { width: 430, height: 932 }],
  ['tectonic', { width: 2560, height: 1080 }],
  ['spiraloid', { width: 1024, height: 1024 }],
  ['halo', { width: 390, height: 844 }],
  ['pixel-ghost', { width: 800, height: 800 }],
  ['echidna', { width: 430, height: 932 }],
  ['echo-nest', { width: 1440, height: 900 }],
];

function pathSignature(points: Vec2[]): string {
  return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join('|');
}

function bendMagnitude(points: Vec2[]): number {
  if (points.length < 3) return 0;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return Math.max(
    ...points.slice(1, -1).map((point) => Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy) / length)
  );
}

test('v4 removes aurora and mycelial from the public morphology surface', () => {
  for (const dimensions of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1080 },
  ]) {
    for (let index = 0; index < 80; index += 1) {
      const tree = buildAdaptiveFractalTree(dimensions, `selection-${index}`, DESTINATIONS);
      assert.notEqual(tree.morphology.id, 'aurora');
      assert.notEqual(tree.morphology.id, 'mycelial');
    }
  }

  const forcedAurora = buildAdaptiveFractalTree(
    { width: 2560, height: 1080 },
    'force:aurora:removed-review',
    DESTINATIONS
  );
  const forcedMycelial = buildAdaptiveFractalTree(
    { width: 1920, height: 1080 },
    'force:mycelial:removed-review',
    DESTINATIONS
  );
  assert.notEqual(forcedAurora.morphology.id, 'aurora');
  assert.notEqual(forcedMycelial.morphology.id, 'mycelial');
});

test('every curated v4 morphology is deterministic, bounded, and keeps all destinations', () => {
  for (const [morphologyId, dimensions] of CURATED) {
    const seed = `force:${morphologyId}:v4-regression`;
    const first = buildAdaptiveFractalTree(dimensions, seed, DESTINATIONS);
    const second = buildAdaptiveFractalTree(dimensions, seed, DESTINATIONS);

    assert.equal(first.morphology.id, morphologyId);
    assert.equal(first.endpoints.size, DESTINATIONS.length);
    assert.ok(first.paths.length > DESTINATIONS.length, `${morphologyId} generated too few paths`);
    assert.ok(first.paths.length <= first.morphology.pathBudget, `${morphologyId} exceeded its path budget`);
    assert.deepEqual(
      first.paths.slice(0, 24).map((path) => `${path.id}:${pathSignature(path.points)}`),
      second.paths.slice(0, 24).map((path) => `${path.id}:${pathSignature(path.points)}`),
      `${morphologyId} should be deterministic for a fixed seed`
    );

    for (const destination of DESTINATIONS) {
      const endpoint = first.endpoints.get(destination);
      assert.ok(endpoint, `${morphologyId} missing ${destination}`);
      assert.ok(endpoint.x >= 0 && endpoint.x <= dimensions.width);
      assert.ok(endpoint.y >= 0 && endpoint.y <= first.usableBottom);
    }

    for (const path of first.paths) {
      assert.ok(path.points.length > 0, `${path.id} is empty`);
      for (const point of path.points) {
        assert.ok(point.x >= 0 && point.x <= dimensions.width, `${path.id} escaped x bounds`);
        assert.ok(point.y >= 0 && point.y <= first.usableBottom, `${path.id} escaped y bounds`);
      }
    }
  }
});

test('non-radial dendrites receive low-frequency organic post-warp while radial stays canonical', () => {
  const coral = buildAdaptiveFractalTree(
    { width: 1920, height: 1080 },
    'force:coral:organic-bend',
    DESTINATIONS
  );
  const coralPrimaries = coral.paths.filter((path) => path.depth === 0 && path.id.startsWith('primary-'));
  assert.ok(coralPrimaries.some((path) => bendMagnitude(path.points) > 5), 'coral primaries should visibly bend');

  const fan = buildAdaptiveFractalTree(
    { width: 1920, height: 1080 },
    'force:fan:organic-bend',
    DESTINATIONS
  );
  const fanPrimaries = fan.paths.filter((path) => path.depth === 0 && path.id.startsWith('primary-'));
  assert.ok(fanPrimaries.some((path) => bendMagnitude(path.points) > 4), 'fan primaries should visibly bend');

  const radialA = buildAdaptiveFractalTree(
    { width: 1440, height: 900 },
    'force:radial:canonical',
    DESTINATIONS
  );
  const radialB = buildAdaptiveFractalTree(
    { width: 1440, height: 900 },
    'force:radial:canonical',
    DESTINATIONS
  );
  assert.deepEqual(
    radialA.paths.slice(0, 16).map((path) => pathSignature(path.points)),
    radialB.paths.slice(0, 16).map((path) => pathSignature(path.points))
  );
});

test('tectonic v4 is a crack field with multiple fault spines and local stress fractures', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 2560, height: 1080 },
    'force:tectonic:rift-proof',
    DESTINATIONS
  );
  const faults = tree.paths.filter((path) => path.id.startsWith('fault-'));
  const stress = tree.paths.filter((path) => path.id.startsWith('stress-'));
  const primaries = tree.paths.filter((path) => path.id.startsWith('primary-'));

  assert.equal(faults.length, 3);
  assert.ok(faults.every((path) => path.points.length >= 28));
  assert.ok(stress.length >= 10, `expected a field of stress fractures, got ${stress.length}`);
  assert.equal(primaries.length, DESTINATIONS.length);
  assert.ok(primaries.every((path) => path.points.length === 3));
});

test('echo nest v4 uses mixed-scale polygon outlines and matte hatch texture', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 1440, height: 900 },
    'force:echo-nest:matte-proof',
    DESTINATIONS
  );
  const outlines = tree.paths.filter((path) => path.id.startsWith('nest-outline-'));
  const matte = tree.paths.filter((path) => path.id.startsWith('matte-'));
  const lattice = tree.paths.filter((path) => path.id.startsWith('nest-lattice-'));

  assert.ok(outlines.length >= 30);
  assert.ok(matte.length >= 90, `expected dense matte hatching, got ${matte.length}`);
  assert.ok(lattice.length >= 10);
  const vertexCounts = new Set(outlines.map((path) => Math.max(0, path.points.length - 1)));
  assert.ok(vertexCounts.has(3), 'triangle cells should remain in the nest');
  assert.ok(vertexCounts.has(4), 'rhombus cells should be present');
  assert.ok(vertexCounts.has(6), 'hexagon cells should be present');
});

test('selection entropy remains non-degenerate after removing two morphologies', () => {
  const seen = new Set<string>();
  const rng = seededRng('v4-selection-smoke');
  for (let index = 0; index < 120; index += 1) {
    const seed = `entropy-${Math.floor(rng() * 1e9)}-${index}`;
    seen.add(buildAdaptiveFractalTree({ width: 1920, height: 1080 }, seed, DESTINATIONS).morphology.id);
  }
  assert.ok(seen.size >= 5, `expected at least five landscape morphologies, saw ${[...seen].join(', ')}`);
  assert.ok(!seen.has('aurora'));
  assert.ok(!seen.has('mycelial'));
});
