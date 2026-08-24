import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdaptiveFractalTree } from '../lib/home/fractalDendriteV5';

const DESTINATIONS = ['frontier', 'games', 'builds', 'systems', 'contact', 'visuals', 'research', 'papers'];

test('v5 echo nest exposes sharp polygon edges instead of rounded multi-point outlines', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 1440, height: 900 },
    'force:echo-nest:sharp-proof',
    DESTINATIONS
  );

  const outerEdges = tree.paths.filter((path) => path.id.includes('nest-outline-') && path.id.includes('-edge-'));
  const innerEdges = tree.paths.filter((path) => path.id.includes('nest-outline-') && path.id.includes('-inner-'));
  const matte = tree.paths.filter((path) => path.id.startsWith('matte-'));

  assert.ok(outerEdges.length >= 100, `expected many sharp polygon edges, got ${outerEdges.length}`);
  assert.ok(innerEdges.length >= 100, `expected inset geometric echoes, got ${innerEdges.length}`);
  assert.ok(matte.length >= 90, `expected matte texture hatching, got ${matte.length}`);
  assert.ok(outerEdges.every((path) => path.points.length === 2));
  assert.ok(innerEdges.every((path) => path.points.length === 2));
});

test('v5 tectonic adds angled tributaries to the wandering fault field', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 2560, height: 1080 },
    'force:tectonic:deep-rift-proof',
    DESTINATIONS
  );

  const faults = tree.paths.filter((path) => path.id.startsWith('fault-'));
  const veins = tree.paths.filter((path) => path.id.startsWith('rift-vein-'));
  const twigs = tree.paths.filter((path) => path.id.startsWith('rift-twig-'));
  const primaries = tree.paths.filter((path) => path.id.startsWith('primary-'));

  assert.equal(faults.length, 3);
  assert.ok(veins.length >= 6, `expected angled fault tributaries, got ${veins.length}`);
  assert.ok(twigs.length >= 2, `expected second-order stress fractures, got ${twigs.length}`);
  assert.equal(primaries.length, DESTINATIONS.length);
  assert.ok(tree.paths.length <= tree.morphology.pathBudget);
});

test('v5 preserves the public removal of aurora and mycelial', () => {
  const aurora = buildAdaptiveFractalTree(
    { width: 2560, height: 1080 },
    'force:aurora:still-removed',
    DESTINATIONS
  );
  const mycelial = buildAdaptiveFractalTree(
    { width: 1920, height: 1080 },
    'force:mycelial:still-removed',
    DESTINATIONS
  );

  assert.notEqual(aurora.morphology.id, 'aurora');
  assert.notEqual(mycelial.morphology.id, 'mycelial');
});
