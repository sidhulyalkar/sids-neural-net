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
    ['stretchicorn', 'unirico', 'unicorn-stampede']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
    assert.equal(game.version, 'main', `${game.title} tracks main`);
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

test('Stretchicorn cabinet tracks live main dist/stretchicorn-local.html', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'stretchicorn');
  assert.ok(game);
  assert.equal(game.version, 'main');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/stretchicorn');
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.deepEqual(game.nativeSize, { width: 960, height: 640 });
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.ok(game.controls.some((control) => control.input === 'Space' && /Rainbow Snap/i.test(control.action)));
  assert.match(game.description, /Live main build/i);
  assert.match(game.description, /13-trial desktop arcade-action/i);
  assert.match(game.description, /Cobtopus Prime/i);

  const route = readRepoFile('app/game-runtimes/stretchicorn/[asset]/route.ts');
  assert.match(route, /STRETCHICORN_SOURCE_REF = 'main'/);
  assert.match(route, /STRETCHICORN_SOURCE_ARTIFACT = 'dist\/stretchicorn-local\.html'/);
  assert.match(route, /tabindex=0/);
  assert.match(route, /host integration check/);
  assert.match(route, /revalidate: 300/);
  assert.match(route, /X-Stretchicorn-Source-Ref/);
  assert.match(route, /X-Stretchicorn-Source-Artifact/);

  const legacy = readRepoFile('app/game-runtimes/stretchicorn/v0.38.0/[asset]/route.ts');
  assert.match(legacy, /redirect/);
  assert.match(legacy, /\/game-runtimes\/stretchicorn\/index\.html/);

  const workflow = readRepoFile('.github/workflows/ci.yml');
  assert.match(workflow, /game-runtimes\/stretchicorn\/index\.html/);
  assert.match(workflow, /x-stretchicorn-source-ref: main/i);
});

test('uniRico cabinet tracks live main src/ assets', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'unirico');
  assert.ok(game);
  assert.equal(game.version, 'main');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/uniRico');
  assert.equal(game.launchUrl, '/game-runtimes/unirico/index.html');
  assert.deepEqual(game.nativeSize, { width: 960, height: 600 });
  assert.ok(game.controls.some((control) => control.input === 'AIM wheel'));
  assert.ok(game.controls.some((control) => control.input === 'FIRE'));
  assert.ok(game.controls.some((control) => control.input === 'Click' && /currently displayed trajectory/i.test(control.action)));
  assert.match(game.description, /Live main build/i);
  assert.match(game.description, /50-level deterministic/i);
  assert.match(game.description, /Reflection Gauntlet/i);

  const route = readRepoFile('app/game-runtimes/unirico/[...asset]/route.ts');
  assert.match(route, /UNIRICO_SOURCE_REF = 'main'/);
  assert.match(route, /redirectToCanonical/);
  assert.match(route, /revalidate: 300/);
  assert.match(route, /X-UniRico-Source-Ref/);

  const workflow = readRepoFile('.github/workflows/ci.yml');
  assert.match(workflow, /game-runtimes\/unirico\/index\.html/);
  assert.match(workflow, /x-unirico-source-ref: main/i);
});

test('Unicorn Stampede cabinet tracks live main dist/local.html', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'unicorn-stampede');
  assert.ok(game);
  assert.equal(game.version, 'main');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/unicorn-stampede');
  assert.equal(game.launchUrl, '/game-runtimes/unicorn-stampede/index.html');
  assert.deepEqual(game.nativeSize, { width: 1280, height: 720 });
  assert.ok(game.controls.some((control) => control.input === 'W A S D'));
  assert.ok(game.controls.some((control) => /Rainbow Whip/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Space'));
  assert.match(game.description, /six-unicorn arcade-strategy/i);
  assert.match(game.description, /js13kGames 2026/i);
  assert.match(game.description, /dist\/local\.html/i);

  const route = readRepoFile('app/game-runtimes/unicorn-stampede/[asset]/route.ts');
  assert.match(route, /UNICORN_STAMPEDE_SOURCE_REF = 'main'/);
  assert.match(route, /UNICORN_STAMPEDE_SOURCE_ARTIFACT = 'dist\/local\.html'/);
  assert.match(route, /unicorn-stampede\/\$\{UNICORN_STAMPEDE_SOURCE_REF\}/);
  assert.match(route, /tabindex=0/);
  assert.match(route, /host integration check/);
  assert.match(route, /X-Unicorn-Stampede-Source-Ref/);
  assert.match(route, /X-Unicorn-Stampede-Source-Artifact/);
  assert.match(route, /revalidate: 300/);

  const workflow = readRepoFile('.github/workflows/ci.yml');
  assert.match(workflow, /arcade\/unicorn-stampede/);
  assert.match(workflow, /game-runtimes\/unicorn-stampede\/index\.html/);
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

test('Game Network browser validation covers live-main Stretchicorn and uniRico contracts', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.match(browserTest, /stretchicorn\/index\.html/);
  assert.match(browserTest, /stageCount/);
  assert.match(browserTest, /COBTOPUS PRIME/);
  assert.match(browserTest, /Space should start Easy at D=0\.7/);
  assert.match(browserTest, /unirico\/index\.html/);
  assert.match(browserTest, /LEVELS\.length/);
  assert.match(browserTest, /MIRROR FULL SPECTRUM/);
  assert.match(browserTest, /finaleTargets !== 6/);
  assert.match(browserTest, /AIM release fired unexpectedly/);
  assert.match(browserTest, /desktop click retargeted away from displayed trajectory/);
  assert.match(browserTest, /dispatchPointer\('pointermove', 'mouse', 780, 180, 81\)/);
  assert.match(browserTest, /dispatchPointer\('pointerdown', 'mouse', 260, 520, 82\)/);
  assert.doesNotMatch(browserTest, /testSylvaria/);
});

test('the legacy embedded Stretchicorn copy remains isolated as a fallback only', () => {
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
    assert.ok(existsSync(join(root, runtimeRoot, runtimeModule)), `missing Stretchicorn fallback runtime file: ${runtimeModule}`);
  }

  // Catalog must launch the live-main route handler, not a version-pinned path.
  const catalog = readRepoFile('src/data/arcadeGames.ts');
  assert.match(catalog, /game-runtimes\/stretchicorn\/index\.html/);
  assert.doesNotMatch(catalog, /game-runtimes\/stretchicorn\/v0\.38\.0/);
});
