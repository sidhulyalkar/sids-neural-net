import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdaptiveFractalTree } from '../lib/home/fractalDendriteV6';

const DESTINATIONS = ['frontier', 'games', 'builds', 'systems', 'contact', 'visuals', 'research', 'papers'];

test('tectonic v6 forms intersecting plate seams instead of parallel horizontal bands', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 2560, height: 1080 },
    'force:tectonic:v6-crackle',
    DESTINATIONS
  );

  const faults = tree.paths.filter((path) => path.id.startsWith('fault-'));
  const seams = tree.paths.filter((path) => path.id.startsWith('plate-seam-'));
  const chips = tree.paths.filter((path) => path.id.startsWith('plate-chip-'));
  const sutures = tree.paths.filter((path) => path.id.startsWith('delta-suture-'));

  assert.equal(faults.length, 3);
  assert.ok(seams.length >= 8, `expected plate seams, got ${seams.length}`);
  assert.ok(chips.length >= 4, `expected local crack branches, got ${chips.length}`);
  assert.ok(sutures.length >= 3, `expected cross-fault sutures, got ${sutures.length}`);
  assert.equal(tree.theoreticalTerminalDimension, 1.58);
  assert.equal(tree.endpoints.size, DESTINATIONS.length);
  assert.ok(tree.paths.length <= tree.morphology.pathBudget);

  const faultSlope = (path: (typeof faults)[number]) => {
    const first = path.points[0];
    const last = path.points[path.points.length - 1];
    return (last.y - first.y) / Math.max(1, last.x - first.x);
  };
  const slopes = faults.map(faultSlope);
  assert.ok(Math.max(...slopes) - Math.min(...slopes) > 0.12, `faults remain too parallel: ${slopes.join(', ')}`);
});

test('echo nest v6 preserves sharp matte lattice and corrected dimension metadata', () => {
  const tree = buildAdaptiveFractalTree(
    { width: 1440, height: 900 },
    'force:echo-nest:v6-metadata',
    DESTINATIONS
  );

  assert.equal(tree.theoreticalTerminalDimension, 1.51);
  assert.ok(tree.paths.some((path) => path.id.includes('nest-outline-') && path.id.includes('-edge-')));
  assert.ok(tree.paths.some((path) => path.id.startsWith('matte-')));
});
