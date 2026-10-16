import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('v13 replaces the soft base canvas with a crisp topology-preserving renderer', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const renderer = readRepoFile('components/neural-atlas-canvas/FractalCrispTopologyV13.tsx');

  assert.match(stage, /FractalCrispTopologyV13/);
  assert.match(renderer, /crispCanvas\.dataset\.fractalCrispTopology = 'v13'/);
  assert.match(renderer, /supersededByCrispTopology = 'v13'/);
  assert.match(renderer, /baseCanvas\.style\.opacity = '0'/);
  assert.match(renderer, /renderFidelity = 'crisp-no-glow-v13'/);
  assert.doesNotMatch(renderer, /shadowBlur/);
});

test('all primary trunks are clipped to the circular CORE edge', () => {
  const renderer = readRepoFile('components/neural-atlas-canvas/FractalCrispTopologyV13.tsx');

  assert.match(renderer, /function trimPrimaryToCoreEdge/);
  assert.match(renderer, /radius \+ 0\.2/);
  assert.match(renderer, /points = trimPrimaryToCoreEdge\(oriented, coreCenter, coreRadius\)/);
  assert.match(renderer, /data-core-clearance-mask="circle-edge-v13"/);
  assert.match(renderer, /coreClearance = 'circle-edge-v13'/);
});

test('primary trunks terminate exactly on measured destination rectangles', () => {
  const renderer = readRepoFile('components/neural-atlas-canvas/FractalCrispTopologyV13.tsx');

  assert.match(renderer, /function measuredDestinationRects/);
  assert.match(renderer, /getBoundingClientRect\(\)/);
  assert.match(renderer, /function rectBoundaryToward/);
  assert.match(renderer, /function appendExactLabelTerminal/);
  assert.match(renderer, /points = appendExactLabelTerminal\(points, destinationRects\.get\(path\.ownerId\)\)/);
  assert.match(renderer, /primaryRouting = 'core-and-label-edge-v13'/);
});

test('secondary dendrites snap to shallower parent segments and orphan twigs are pruned', () => {
  const renderer = readRepoFile('components/neural-atlas-canvas/FractalCrispTopologyV13.tsx');

  assert.match(renderer, /function nearestPointOnSegment/);
  assert.match(renderer, /function snapBranchRoot/);
  assert.match(renderer, /parent\.depth >= depth/);
  assert.match(renderer, /bestDistance > maxAttachDistance/);
  assert.match(renderer, /polylineLength\(repaired\) < minBranchLength/);
  assert.match(renderer, /topologyRepair = 'snap-prune-v13'/);
});

test('CORE proxy remains the sole protected visible CORE above auxiliary canvases', () => {
  const renderer = readRepoFile('components/neural-atlas-canvas/FractalCrispTopologyV13.tsx');

  assert.match(renderer, /data-core-proxy="v13"/);
  assert.match(renderer, /z-\[30\]/);
  assert.match(renderer, /bg-\[#02080c\]/);
  assert.match(renderer, /originalCore\.removeAttribute\('data-core-placement'\)/);
  assert.match(renderer, /originalCore\.removeAttribute\('data-navigation-clearance'\)/);
  assert.match(renderer, /hiddenOriginalCore\.style\.pointerEvents/);
});
