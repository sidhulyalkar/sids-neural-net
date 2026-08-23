import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const EXPECTED_COMMIT = '5635de71cae80a7728a45b11fd660fd87112c351';
const EXPECTED_ASSETS = [
  'index.html',
  'src/style.css',
  'src/00-core.js',
  'src/01-combat.js',
  'src/02-update.js',
  'src/03-render.js',
  'src/04-ui-input.js',
];

test('Stretchicorn cabinet points at the current public v0.21.1 release', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'stretchicorn');
  assert.ok(game);
  assert.equal(game.version, 'v0.21.1');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(game.sourceCommit, EXPECTED_COMMIT);
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /13 trials and four difficulty modes/);
});

test('canonical Stretchicorn runtime is served from an exact allowlisted upstream commit', () => {
  const route = readRepoFile('app/game-runtimes/stretchicorn/[...asset]/route.ts');
  const gateway = readRepoFile('lib/arcade/pinnedGithubRuntime.ts');

  assert.match(route, new RegExp(EXPECTED_COMMIT));
  assert.match(route, /owner: 'sidhulyalkar'/);
  assert.match(route, /repo: 'stretchicorn'/);
  assert.match(route, /servePinnedGithubRuntimeAsset/);

  for (const asset of EXPECTED_ASSETS) {
    assert.match(route, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(gateway, /raw\.githubusercontent\.com\/\$\{runtime\.owner\}\/\$\{runtime\.repo\}/);
  assert.match(gateway, /game-network-bridge\.js/);
  assert.match(gateway, /runtime\.allowedAssets\.has\(path\)/);
  assert.match(gateway, /!path\.includes\('\.\.'\)/);
  assert.match(gateway, /frame-ancestors 'self'/);
  assert.match(gateway, /max-age=31536000, immutable/);
  assert.match(gateway, /X-Arcade-Upstream-Repo/);
  assert.match(gateway, /X-Arcade-Upstream-Commit/);
  assert.match(gateway, /AbortSignal\.timeout\(8_000\)/);
});
