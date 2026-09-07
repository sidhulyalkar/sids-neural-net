import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const EXPECTED_ARTIFACT = 'dist/stretchicorn-local.html';

test('Stretchicorn cabinet tracks live main of the public stretchicorn repo', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'stretchicorn');
  assert.ok(game);
  assert.equal(game.version, 'main');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /Live main build/i);
  assert.match(game.description, /Impossible Encore/i);
});

test('live Stretchicorn runtime fetches main without a version rewrite', () => {
  const nextConfig = readRepoFile('next.config.ts');
  assert.doesNotMatch(nextConfig, /source: '\/game-runtimes\/stretchicorn\/:asset\*'/);
  assert.doesNotMatch(nextConfig, /destination: '\/game-runtimes\/stretchicorn\/v0\.38\.0\/index\.html'/);

  const route = readRepoFile('app/game-runtimes/stretchicorn/[asset]/route.ts');
  assert.match(route, /STRETCHICORN_SOURCE_REF = 'main'/);
  assert.match(route, new RegExp(EXPECTED_ARTIFACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(route, /raw\.githubusercontent\.com\/sidhulyalkar\/stretchicorn/);
  assert.match(route, /game-network-bridge\.js/);
  assert.match(route, /canvas id=c tabindex=0/);
  assert.match(route, /frame-ancestors 'self'/);
  assert.match(route, /revalidate: 300/);
  assert.match(route, /X-Stretchicorn-Source-Ref/);
  assert.match(route, /X-Stretchicorn-Source-Artifact/);

  const legacy = readRepoFile('app/game-runtimes/stretchicorn/v0.38.0/[asset]/route.ts');
  assert.match(legacy, /redirect/);
  assert.match(legacy, /\/game-runtimes\/stretchicorn\/index\.html/);
});
