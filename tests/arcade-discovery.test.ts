import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const gameNetworkSurfaces = [
  'app/page.tsx',
  'app/arcade/page.tsx',
  'app/arcade/[slug]/page.tsx',
  'components/arcade/ArcadePlaySpace.tsx',
  'components/layout/ArcadeDiscovery.tsx',
  'components/layout/Footer.tsx',
  'src/data/siteNav.ts',
];

test('the Game Network exposes every current game as a playable entry', () => {
  assert.deepEqual(
    arcadeGames.map((game) => game.slug),
    ['stretchicorn', 'unirico', 'mosslight']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }
});

test('Sprid is the canonical Mosslight protagonist name', () => {
  const mosslight = arcadeGames.find((game) => game.slug === 'mosslight');
  assert.ok(mosslight);
  assert.match(mosslight.description, /Sprid/);
  assert.ok(mosslight.controls.some((control) => /Sprid/.test(control.action)));

  for (const path of [
    'public/game-runtimes/mosslight-v2/index.html',
    'src/data/arcadeGames.ts',
    'docs/MOSSLIGHT_MOSSGLINT_RUN_V04.md',
    'docs/MOSSLIGHT_V02_PLAYABILITY_AND_VISUAL_REVIEW.md',
  ]) {
    const source = readRepoFile(path);
    assert.match(source, /Sprid/, `${path} should name Sprid`);
    assert.doesNotMatch(source, /Sprig/, `${path} still contains the retired Sprig name`);
  }
});

test('Game Network naming is consistent across every visible discovery surface', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  for (const path of gameNetworkSurfaces) {
    const source = readRepoFile(path);
    assert.doesNotMatch(source, /Game Arcade|game arcade/, `${path} still contains the old Game Arcade label`);
  }

  const home = readRepoFile('app/page.tsx');
  assert.match(home, /href="\/arcade"/);
  assert.match(home, /game network/i);
  assert.match(home, /data-gesture-target/);

  const footer = readRepoFile('components/layout/Footer.tsx');
  assert.match(footer, /href: '\/arcade', label: 'Game Network'/);

  const discovery = readRepoFile('components/layout/ArcadeDiscovery.tsx');
  assert.match(discovery, /'\/about': 'core'/);
  assert.match(discovery, /'\/projects': 'builds'/);
  assert.match(discovery, /href="\/arcade"/);
  assert.match(discovery, /game network/);
});

test('the Game Network index stays intentionally minimal', () => {
  const page = readRepoFile('app/arcade/page.tsx');
  const catalog = readRepoFile('components/arcade/ArcadeCatalog.tsx');

  assert.match(page, />\s*game network\s*</);
  assert.doesNotMatch(page, /interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);
  assert.doesNotMatch(catalog, /game\.subtitle|game\.version|game\.description|game\.tags/);
});

test('Vercel allows the site to embed its own game runtimes without allowing cross-site framing', () => {
  const vercelConfig = JSON.parse(readRepoFile('vercel.json')) as {
    headers?: Array<{
      source?: string;
      headers?: Array<{ key?: string; value?: string }>;
    }>;
  };

  const globalHeaders = vercelConfig.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? [];
  const frameOption = globalHeaders.find((header) => header.key === 'X-Frame-Options')?.value;
  assert.equal(frameOption, 'SAMEORIGIN');
  assert.notEqual(frameOption, 'DENY');

  for (const source of ['/game-runtimes/stretchicorn/(.*)', '/game-runtimes/mosslight-v2/(.*)']) {
    const runtimeHeaders = vercelConfig.headers?.find((rule) => rule.source === source)?.headers ?? [];
    assert.ok(
      runtimeHeaders.some(
        (header) => header.key === 'Content-Security-Policy' && header.value === "frame-ancestors 'self'"
      ),
      `${source} must remain frameable by the portfolio origin only`
    );
  }
});

test('Game Network browser validation includes actual Google Chrome Stable', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /playwright@1\.55\.0 install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testMosslight\(page, engineName\)/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
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
