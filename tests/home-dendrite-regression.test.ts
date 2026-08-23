import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('homepage keeps the original six-primary dendrite morphology', () => {
  const dendrite = readRepoFile('components/neural-atlas-canvas/MinimalDendriteHome.tsx');

  assert.match(dendrite, /const treeRadius = Math\.min\(viewportWidth, viewportHeight\) \* 0\.38/);
  assert.match(dendrite, /const primaryCount = 6/);
  assert.match(dendrite, /const secondaryCount = 2 \+ Math\.floor\(rng\(\) \* 3\)/);
  assert.match(dendrite, /const terminalCount = 1 \+ Math\.floor\(rng\(\) \* 3\)/);

  assert.doesNotMatch(dendrite, /EDGE_MARGIN_MIN/);
  assert.doesNotMatch(dendrite, /PRIMARY_ENDPOINT_LABELS/);
  assert.doesNotMatch(dendrite, /getOpenLabelPlacement/);
  assert.doesNotMatch(dendrite, /containPath/);
});

test('FRONTIER and Game Network stay peripheral instead of becoming dendrites', () => {
  const home = readRepoFile('app/page.tsx');
  const dendrite = readRepoFile('components/neural-atlas-canvas/MinimalDendriteHome.tsx');

  assert.match(home, /href: '\/frontier'/);
  assert.match(home, /href: '\/arcade'/);
  assert.match(home, /Homepage peripheral destinations/);
  assert.match(home, /fixed right-4 top-4/);
  assert.match(home, /data-gesture-target/);

  assert.doesNotMatch(dendrite, /FRONTIER/i);
  assert.doesNotMatch(dendrite, /Game Network/i);
});
