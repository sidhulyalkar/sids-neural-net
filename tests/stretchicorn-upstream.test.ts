import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const EXPECTED_COMMIT = '07d38322d5b9927a9b9eca6fec38546925801c16';
const EXPECTED_ARTIFACT = 'dist/stretchicorn-local.html';

test('Stretchicorn cabinet points at the current public v0.38.0 main release', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'stretchicorn');
  assert.ok(game);
  assert.equal(game.version, 'v0.38.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/v0.38.0/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /current v0\.38\.0 main release/i);
  assert.match(game.description, /Impossible Encore/i);
});

test('versioned Stretchicorn runtime owns v0.38.0 without a stale wildcard rewrite', () => {
  const nextConfig = readRepoFile('next.config.ts');
  assert.doesNotMatch(nextConfig, /source: '\/game-runtimes\/stretchicorn\/:asset\*'/);
  assert.match(nextConfig, /source: '\/game-runtimes\/stretchicorn\/index\.html'/);
  assert.match(nextConfig, /destination: '\/game-runtimes\/stretchicorn\/v0\.38\.0\/index\.html'/);
  assert.match(nextConfig, /beforeFiles/);

  const route = readRepoFile('app/game-runtimes/stretchicorn/v0.38.0/[asset]/route.ts');
  assert.match(route, new RegExp(EXPECTED_COMMIT));
  assert.match(route, new RegExp(EXPECTED_ARTIFACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(route, /raw\.githubusercontent\.com\/sidhulyalkar\/stretchicorn/);
  assert.match(route, /game-network-bridge\.js/);
  assert.match(route, /canvas id=c tabindex=0/);
  assert.match(route, /frame-ancestors 'self'/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /X-Stretchicorn-Version/);
  assert.match(route, /X-Stretchicorn-Source-Commit/);
  assert.match(route, /X-Stretchicorn-Source-Artifact/);
});
