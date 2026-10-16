import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { isArcadeGamePath } from '../lib/arcade/routeScope';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('arcade game routes are isolated from site-level interaction extras', () => {
  assert.equal(isArcadeGamePath(null), false);
  assert.equal(isArcadeGamePath('/'), false);
  assert.equal(isArcadeGamePath('/arcade'), false);
  assert.equal(isArcadeGamePath('/arcade/'), false);
  assert.equal(isArcadeGamePath('/arcade/unicorn-stampede'), true);
  assert.equal(isArcadeGamePath('/arcade/unicorn-stampede/'), true);
  assert.equal(isArcadeGamePath('/arcade/stretchicorn'), true);
  assert.equal(isArcadeGamePath('/frontier'), false);

  const cursorShell = readRepoFile('components/effects/SiteNeuronCursor.tsx');
  const sensingShell = readRepoFile('components/sensing/InteractionCapabilityProvider.tsx');
  const layout = readRepoFile('app/layout.tsx');

  assert.match(cursorShell, /isArcadeGamePath\(pathname\)/);
  assert.match(cursorShell, /dynamic\([\s\S]*NeuronCursor/);
  assert.match(sensingShell, /isArcadeGamePath\(pathname\)/);
  assert.match(sensingShell, /dynamic\([\s\S]*SensingToggle/);
  assert.match(sensingShell, /dynamic\([\s\S]*SensingProvider/);
  assert.match(layout, /<SiteNeuronCursor\s*\/>/);
  assert.doesNotMatch(layout, /<NeuronCursor\s*\/>/);
});

test('arcade host uses one accessible deterministic hex back control', () => {
  const playSpace = readRepoFile('components/arcade/ArcadePlaySpace.tsx');

  assert.match(playSpace, /data-arcade-back-control="hex"/);
  assert.match(playSpace, /aria-label="Back to Game Network"/);
  assert.match(playSpace, /href="\/arcade"/);
  assert.match(playSpace, /<polygon[\s\S]*points="22 2 40 12\.5 40 35\.5 22 46 4 35\.5 4 12\.5"/);
  assert.match(playSpace, /d="M25 15\.5 17 24l8 8\.5"/);
  assert.doesNotMatch(playSpace, /←\s*game network/i);
});
