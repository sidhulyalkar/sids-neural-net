import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const EXPECTED_COMMIT = '33a0ec77bc5abb9a3644bf1eca367d26cd439ec8';
const EXPECTED_ARTIFACT = 'dist/local.html';

test('Unicorn Stampede cabinet points at the current public v0.20.0 main release', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'unicorn-stampede');
  assert.ok(game);
  assert.equal(game.version, 'v0.20.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/unicorn-stampede');
  assert.equal(game.launchUrl, '/game-runtimes/unicorn-stampede/v0.20.0/index.html');
  assert.deepEqual(game.nativeSize, { width: 1280, height: 720 });
  assert.ok(game.controls.some((control) => control.input === 'W A S D'));
  assert.ok(game.controls.some((control) => /Rainbow Whip/i.test(control.action)));
  assert.match(game.description, /current v0\.20\.0 main release/i);
  assert.match(game.description, /six-unicorn arcade-strategy/i);
  assert.match(game.description, /Stampede\+/i);
});

test('versioned Unicorn Stampede runtime pins the qualified dist/local.html snapshot', () => {
  const nextConfig = readRepoFile('next.config.ts');
  assert.match(nextConfig, /source: '\/game-runtimes\/unicorn-stampede\/index\.html'/);
  assert.match(nextConfig, /destination: '\/game-runtimes\/unicorn-stampede\/v0\.20\.0\/index\.html'/);

  const route = readRepoFile('app/game-runtimes/unicorn-stampede/v0.20.0/[asset]/route.ts');
  assert.match(route, new RegExp(EXPECTED_COMMIT));
  assert.match(route, new RegExp(EXPECTED_ARTIFACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(route, /raw\.githubusercontent\.com\/sidhulyalkar\/unicorn-stampede/);
  assert.match(route, /game-network-bridge\.js/);
  assert.match(route, /canvas id=c tabindex=0/);
  assert.match(route, /frame-ancestors 'self'/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /X-Unicorn-Stampede-Version/);
  assert.match(route, /X-Unicorn-Stampede-Source-Commit/);
  assert.match(route, /X-Unicorn-Stampede-Source-Artifact/);
  assert.match(route, /<title>Unicorn Stampede<\/title>/);
  assert.match(route, /canvas id=c width=1280 height=720/);
});
