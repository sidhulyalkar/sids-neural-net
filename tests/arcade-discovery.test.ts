import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';
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

test('the Game Network exposes only the currently active games', () => {
  assert.deepEqual(
    arcadeGames.map((game) => game.slug),
    ['stretchicorn', 'unirico']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }

  assert.equal(getArcadeGame('sylvaria'), undefined);
  assert.equal(getArcadeGame('mosslight'), undefined);
});

test('paused Sylvaria routes fall through the generic cabinet route to notFound', () => {
  const route = readRepoFile('app/arcade/[slug]/page.tsx');
  assert.match(route, /getArcadeGame/);
  assert.match(route, /notFound\(\)/);

  const catalog = readRepoFile('src/data/arcadeGames.ts');
  const sitemap = readRepoFile('app/sitemap.ts');
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserMatrix = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  for (const source of [catalog, sitemap, workflow, browserMatrix]) {
    assert.doesNotMatch(source, /\/arcade\/sylvaria|\/arcade\/mosslight/);
  }
  assert.doesNotMatch(catalog, /slug: 'sylvaria'/);
  assert.doesNotMatch(catalog, /slug === 'mosslight'/);
  assert.doesNotMatch(browserMatrix, /testSylvaria|MOSSLIGHT_PLAYTEST|MosslightExpedition/);
});

test('Stretchicorn cabinet points at the current v0.21.1 public release', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'stretchicorn');
  assert.ok(game);
  assert.equal(game.version, 'v0.21.1');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /Impossible Encore/);
});

test('uniRico cabinet pins the v0.20.0 50-level release with cache-safe runtime URLs', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'unirico');
  assert.ok(game);
  assert.equal(game.version, 'v0.20.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/uniRico');
  assert.equal(game.launchUrl, '/game-runtimes/unirico/v0.20.0/index.html');
  assert.deepEqual(game.nativeSize, { width: 960, height: 600 });
  assert.ok(game.controls.some((control) => control.input === 'AIM wheel'));
  assert.ok(game.controls.some((control) => control.input === 'FIRE'));
  assert.ok(game.controls.some((control) => control.input === 'Click' && /currently displayed trajectory/i.test(control.action)));
  assert.match(game.description, /50-level deterministic/i);
  assert.match(game.description, /Reflection Gauntlet/i);
  assert.match(game.description, /authoritative visible desktop trajectory/i);

  const route = readRepoFile('app/game-runtimes/unirico/[...asset]/route.ts');
  assert.match(route, /UNIRICO_VERSION = 'v0\.20\.0'/);
  assert.match(route, /UNIRICO_SOURCE_COMMIT = 'a9350c6a47d5fa2cac85ffb8e4874cffc87ef2a2'/);
  assert.match(route, /redirectLegacyAsset/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /X-UniRico-Version/);
  assert.match(route, /X-UniRico-Source-Commit/);
});

test('FRONTIER and Game Network coexist in current navigation', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/frontier' && item.label === 'FRONTIER'));
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/frontier'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  const home = readRepoFile('app/page.tsx');
  const fractalHome = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalHome.tsx');

  assert.match(home, /AdaptiveFractalHome/);
  assert.match(fractalHome, /id: 'frontier'.*href: '\/frontier'/);
  assert.match(fractalHome, /id: 'games'.*label: 'Game Network'.*href: '\/arcade'/);
  assert.match(fractalHome, /aria-label=\{`Open \$\{destination\.label\}`\}/);
  assert.match(fractalHome, /data-dendrite-destination=\{destination\.id\}/);
  assert.match(fractalHome, /data-gesture-target/);
});

test('Game Network naming is consistent across discovery surfaces', () => {
  for (const path of gameNetworkSurfaces) {
    const source = readRepoFile(path);
    assert.doesNotMatch(source, /Game Arcade|game arcade/, `${path} still contains the old Game Arcade label`);
  }

  const footer = readRepoFile('components/layout/Footer.tsx');
  assert.match(footer, /href: '\/arcade', label: 'Game Network'/);

  const discovery = readRepoFile('components/layout/ArcadeDiscovery.tsx');
  assert.match(discovery, /href="\/arcade"/);
  assert.match(discovery, /game network/i);
});

test('the Game Network index stays intentionally minimal', () => {
  const page = readRepoFile('app/arcade/page.tsx');
  const catalog = readRepoFile('components/arcade/ArcadeCatalog.tsx');

  assert.match(page, />\s*game network\s*</i);
  assert.doesNotMatch(page, /interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);
  assert.doesNotMatch(catalog, /game\.subtitle|game\.version|game\.description|game\.tags/);
});

test('Game Network browser validation covers v0.20.0 aim and campaign truth in four engines', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.match(browserTest, /uniRico v0\.20\.0/);
  assert.match(browserTest, /LEVELS\.length/);
  assert.match(browserTest, /MIRROR FULL SPECTRUM/);
  assert.match(browserTest, /finaleTargets !== 6/);
  assert.match(browserTest, /AIM release fired unexpectedly/);
  assert.match(browserTest, /desktop click retargeted away from displayed trajectory/);
  assert.match(browserTest, /dispatchPointer\('pointermove', 'mouse', 780, 180, 81\)/);
  assert.match(browserTest, /dispatchPointer\('pointerdown', 'mouse', 260, 520, 82\)/);
  assert.doesNotMatch(browserTest, /testSylvaria/);
});

test('the embedded Stretchicorn fallback release remains complete', () => {
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
});
