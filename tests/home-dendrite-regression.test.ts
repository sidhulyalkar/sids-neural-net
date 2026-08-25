import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  FRACTAL_PROFILES,
  buildAdaptiveFractalTree,
  chooseFractalMorphology,
  getFractalViewportGeometry,
  theoreticalSelfSimilarDimension,
  type Dimensions,
  type FractalMorphologyId,
} from '../lib/home/fractalDendrite';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const DESTINATION_IDS = [
  'frontier',
  'games',
  'builds',
  'systems',
  'contact',
  'visuals',
  'research',
  'papers',
];

const MORPHOLOGY_FIXTURES: Record<FractalMorphologyId, Dimensions> = {
  radial: { width: 1440, height: 900 },
  coral: { width: 1440, height: 900 },
  fan: { width: 1920, height: 1080 },
  apical: { width: 390, height: 844 },
  tectonic: { width: 2560, height: 1080 },
  spiraloid: { width: 1024, height: 1024 },
  mycelial: { width: 1920, height: 1080 },
  halo: { width: 390, height: 844 },
  'pixel-ghost': { width: 800, height: 800 },
  aurora: { width: 2560, height: 1080 },
  echidna: { width: 430, height: 932 },
  'echo-nest': { width: 1440, height: 900 },
};

test('homepage promotes all eight destinations into the dendritic field', () => {
  const home = readRepoFile('app/page.tsx');
  const dendrite = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalHome.tsx');

  assert.match(home, /AdaptiveFractalHome/);
  assert.doesNotMatch(home, /DendriticPortalLink/);
  assert.doesNotMatch(home, /Homepage peripheral destinations/);

  assert.match(dendrite, /href: '\/frontier'/);
  assert.match(dendrite, /href: '\/arcade'/);
  assert.match(dendrite, /data-home-branch-count=\{HOME_BRANCH_COUNT\}/);
  assert.match(dendrite, /data-dendrite-destination/);
  assert.match(dendrite, /data-gesture-target/);
  assert.match(dendrite, /params\.get\('morph'\)/);
  assert.match(dendrite, /data-fractal-seed/);
  assert.equal(DESTINATION_IDS.length, 8);
});

test('wide viewports use width-aware geometry instead of min-dimension radius', () => {
  const geometry = getFractalViewportGeometry({ width: 1920, height: 1080 });

  assert.ok(geometry.radiusX > 800, `expected wide horizontal reach, got ${geometry.radiusX}`);
  assert.ok(geometry.radiusX / 1920 > 0.42);
  assert.ok(geometry.radiusX > geometry.radiusY * 1.8);
  assert.equal(geometry.ultrawide, false);
  assert.equal(geometry.extremeWide, false);

  const ultrawide = getFractalViewportGeometry({ width: 2560, height: 1080 });
  assert.equal(ultrawide.ultrawide, true);
  assert.equal(ultrawide.extremeWide, true);
  assert.ok(ultrawide.radiusX / 2560 > 0.43);
});

test('morphology adapts to viewport class while staying deterministic for a seed', () => {
  const compact = chooseFractalMorphology({ width: 390, height: 844 }, 'seed-a');
  assert.ok(['halo', 'apical', 'echidna', 'spiraloid', 'pixel-ghost'].includes(compact.id));

  const first = chooseFractalMorphology({ width: 1440, height: 900 }, 'seed-b');
  const second = chooseFractalMorphology({ width: 1440, height: 900 }, 'seed-b');
  assert.equal(first.id, second.id);

  const ultrawide = chooseFractalMorphology({ width: 2560, height: 1080 }, 'seed-c');
  assert.ok(['aurora', 'tectonic', 'mycelial', 'fan', 'echo-nest'].includes(ultrawide.id));
});

test('every morphology can be forced deterministically for visual review', () => {
  const morphologyIds = Object.keys(FRACTAL_PROFILES) as FractalMorphologyId[];
  assert.deepEqual(morphologyIds.sort(), Object.keys(MORPHOLOGY_FIXTURES).sort());

  for (const morphologyId of morphologyIds) {
    const dimensions = MORPHOLOGY_FIXTURES[morphologyId];
    const first = chooseFractalMorphology(dimensions, `force:${morphologyId}:fixture`);
    const second = chooseFractalMorphology(dimensions, `force:${morphologyId}:fixture`);
    assert.equal(first.id, morphologyId);
    assert.equal(second.id, morphologyId);
  }
});

test('fractal recursion targets a dendritic self-similar dimension', () => {
  const dimension = theoreticalSelfSimilarDimension(2, 0.66);
  assert.ok(dimension > 1.6 && dimension < 1.75, `unexpected dimension ${dimension}`);
});

test('all twelve morphology engines stay bounded and preserve navigation endpoints', () => {
  for (const [morphologyId, dimensions] of Object.entries(MORPHOLOGY_FIXTURES) as Array<
    [FractalMorphologyId, Dimensions]
  >) {
    const tree = buildAdaptiveFractalTree(
      dimensions,
      `force:${morphologyId}:geometry-regression`,
      DESTINATION_IDS
    );

    assert.equal(tree.morphology.id, morphologyId);
    assert.equal(tree.endpoints.size, DESTINATION_IDS.length);
    assert.ok(tree.paths.length > DESTINATION_IDS.length, `${morphologyId} generated too few paths`);
    assert.ok(tree.paths.length <= tree.morphology.pathBudget);

    for (const destinationId of DESTINATION_IDS) {
      const endpoint = tree.endpoints.get(destinationId);
      assert.ok(endpoint, `missing endpoint ${destinationId} for ${morphologyId}`);
      assert.ok(endpoint.x >= 0 && endpoint.x <= dimensions.width);
      assert.ok(endpoint.y >= 0 && endpoint.y <= tree.usableBottom);
    }

    for (const path of tree.paths) {
      assert.ok(path.points.length > 0, `${path.id} is empty`);
      for (const point of path.points) {
        assert.ok(point.x >= 0 && point.x <= dimensions.width, `${path.id} escaped x bounds`);
        assert.ok(point.y >= 0 && point.y <= tree.usableBottom, `${path.id} escaped y bounds`);
      }
    }
  }
});

test('specialized morphologies expose their intended render primitives', () => {
  const pixel = buildAdaptiveFractalTree(
    MORPHOLOGY_FIXTURES['pixel-ghost'],
    'force:pixel-ghost:primitive',
    DESTINATION_IDS
  );
  assert.ok(pixel.paths.some((path) => path.renderMode === 'pixel'));
  assert.ok(pixel.paths.some((path) => path.renderMode === 'stroke'));

  const nest = buildAdaptiveFractalTree(
    MORPHOLOGY_FIXTURES['echo-nest'],
    'force:echo-nest:primitive',
    DESTINATION_IDS
  );
  assert.ok(nest.paths.some((path) => path.renderMode === 'stencil' && path.closed));

  for (const morphologyId of ['tectonic', 'aurora', 'mycelial', 'halo', 'echidna', 'spiraloid'] as const) {
    const tree = buildAdaptiveFractalTree(
      MORPHOLOGY_FIXTURES[morphologyId],
      `force:${morphologyId}:primitive`,
      DESTINATION_IDS
    );
    assert.ok(tree.paths.some((path) => path.renderMode === 'stroke'));
  }
});
