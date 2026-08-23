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
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /Impossible Encore/);
});

test('canonical Stretchicorn runtime URLs are shadowed by the pinned upstream proxy', () => {
  const nextConfig = readRepoFile('next.config.ts');
  assert.match(nextConfig, /source: '\/game-runtimes\/stretchicorn\/:asset\*'/);
  assert.match(nextConfig, /destination: '\/game-runtimes\/stretchicorn-upstream\/:asset\*'/);
  assert.match(nextConfig, /beforeFiles/);

  const proxy = readRepoFile('app/game-runtimes/stretchicorn-upstream/[...asset]/route.ts');
  assert.match(proxy, new RegExp(EXPECTED_COMMIT));
  assert.match(proxy, /raw\.githubusercontent\.com\/sidhulyalkar\/stretchicorn/);
  assert.match(proxy, /game-network-bridge\.js/);
  assert.match(proxy, /tabindex="0"/);
  assert.match(proxy, /aria-label="Stretchicorn arcade game"/);
  assert.match(proxy, /frame-ancestors 'self'/);
  assert.match(proxy, /max-age=31536000, immutable/);

  for (const asset of EXPECTED_ASSETS) {
    assert.match(proxy, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
