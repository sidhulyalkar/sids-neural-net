import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildAdaptiveFractalTree,
  chooseFractalMorphology,
  getFractalViewportGeometry,
  theoreticalSelfSimilarDimension,
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
  assert.equal(DESTINATION_IDS.length, 8);
});

test('wide viewports use width-aware geometry instead of min-dimension radius', () => {
  const geometry = getFractalViewportGeometry({ width: 1920, height: 1080 });

  assert.ok(geometry.radiusX > 800, `expected wide horizontal reach, got ${geometry.radiusX}`);
  assert.ok(geometry.radiusX / 1920 > 0.42);
  assert.ok(geometry.radiusX > geometry.radiusY * 1.8);
  assert.equal(geometry.ultrawide, false);

  const ultrawide = getFractalViewportGeometry({ width: 2560, height: 1080 });
  assert.equal(ultrawide.ultrawide, true);
  assert.ok(ultrawide.radiusX / 2560 > 0.43);
});

test('morphology adapts to viewport class while staying deterministic for a seed', () => {
  const compact = chooseFractalMorphology({ width: 390, height: 844 }, 'seed-a');
  assert.equal(compact.id, 'apical');

  const first = chooseFractalMorphology({ width: 1440, height: 900 }, 'seed-b');
  const second = chooseFractalMorphology({ width: 1440, height: 900 }, 'seed-b');
  assert.equal(first.id, second.id);

  const ultrawide = chooseFractalMorphology({ width: 2560, height: 1080 }, 'seed-c');
  assert.ok(['fan', 'coral'].includes(ultrawide.id));
});

test('fractal recursion targets a dendritic self-similar dimension', () => {
  const dimension = theoreticalSelfSimilarDimension(2, 0.66);
  assert.ok(dimension > 1.6 && dimension < 1.75, `unexpected dimension ${dimension}`);
});

test('generated trees stay bounded and preserve one endpoint per destination', () => {
  for (const dimensions of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    const tree = buildAdaptiveFractalTree(dimensions, 'geometry-regression', DESTINATION_IDS);

    assert.equal(tree.endpoints.size, DESTINATION_IDS.length);
    assert.ok(tree.paths.length > DESTINATION_IDS.length * 10);
    assert.ok(tree.paths.length <= tree.morphology.pathBudget);

    for (const destinationId of DESTINATION_IDS) {
      const endpoint = tree.endpoints.get(destinationId);
      assert.ok(endpoint, `missing endpoint ${destinationId}`);
      assert.ok(endpoint.x >= 0 && endpoint.x <= dimensions.width);
      assert.ok(endpoint.y >= 0 && endpoint.y <= tree.usableBottom);
    }

    for (const path of tree.paths) {
      for (const point of path.points) {
        assert.ok(point.x >= 0 && point.x <= dimensions.width, `${path.id} escaped x bounds`);
        assert.ok(point.y >= 0 && point.y <= tree.usableBottom, `${path.id} escaped y bounds`);
      }
    }
  }
});
