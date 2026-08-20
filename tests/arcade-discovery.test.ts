import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();

const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('the arcade exposes every current game as a playable cabinet', () => {
  assert.deepEqual(
    arcadeGames.map((game) => game.slug),
    ['stretchicorn', 'unirico', 'mosslight']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }
});

test('the arcade is part of the shared portfolio navigation', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Arcade'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  const home = readRepoFile('app/page.tsx');
  assert.match(home, /href="\/arcade"/);
  assert.match(home, /Playable now · 3 games/);
  assert.match(home, /Stretchicorn · uniRico · Mosslight/);
  assert.match(home, /z-\[70\]/);
  assert.match(home, /data-gesture-target/);

  const footer = readRepoFile('components/layout/Footer.tsx');
  assert.match(footer, /href: '\/arcade', label: 'Arcade'/);

  const discovery = readRepoFile('components/layout/ArcadeDiscovery.tsx');
  assert.match(discovery, /pathname === '\/about'/);
  assert.match(discovery, /pathname === '\/projects'/);
  assert.match(discovery, /href="\/arcade"/);
});

test('the embedded Stretchicorn release is complete', () => {
  const runtimeRoot = 'public/game-runtimes/stretchicorn';
  const runtimeModules = [
    'src/style.css',
    'src/00-core.js',
    'src/01-combat.js',
    'src/02-update.js',
    'src/03-render.js',
    'src/04-ui-input.js',
  ];

  assert.ok(existsSync(join(root, runtimeRoot, 'index.html')));
  for (const runtimeModule of runtimeModules) {
    assert.ok(existsSync(join(root, runtimeRoot, runtimeModule)), `missing Stretchicorn runtime file: ${runtimeModule}`);
  }

  const html = readRepoFile(`${runtimeRoot}/index.html`);
  for (const runtimeModule of runtimeModules.filter((entry) => entry.endsWith('.js'))) {
    assert.match(html, new RegExp(runtimeModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});
