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
  'components/neural-atlas-canvas/RadialDendriteHome.tsx',
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
    assert.equal(game.sourceVisibility, 'public');
    assert.match(game.sourceCommit ?? '', /^[0-9a-f]{40}$/);
  }

  assert.equal(getArcadeGame('sylvaria'), undefined);
  assert.equal(getArcadeGame('mosslight'), undefined);
});

test('paused Sylvaria routes fall through the generic cabinet route to notFound', () => {
  const route = readRepoFile('app/arcade/[slug]/page.tsx');
  assert.match(route, /getArcadeGame/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /dynamicParams = false/);

  const catalog = readRepoFile('src/data/arcadeGames.ts');
  const sitemap = readRepoFile('app/sitemap.ts');
  const browserMatrix = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  for (const source of [catalog, sitemap, browserMatrix]) {
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
  assert.equal(game.sourceCommit, '5635de71cae80a7728a45b11fd660fd87112c351');
  assert.equal(game.launchUrl, '/game-runtimes/stretchicorn/index.html');
  assert.ok(game.controls.some((control) => control.input === '1 / 2 / 3 / 4'));
  assert.match(game.description, /13 trials and four difficulty modes/);
});

test('FRONTIER and Game Network coexist in current navigation and the eight-way homepage', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/frontier' && item.label === 'FRONTIER'));
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/frontier'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  const home = readRepoFile('app/page.tsx');
  const radialHome = readRepoFile('components/neural-atlas-canvas/RadialDendriteHome.tsx');
  assert.match(home, /RadialDendriteHome/);
  assert.match(radialHome, /id: 'frontier'.*href: '\/frontier'/);
  assert.match(radialHome, /id: 'games'.*href: '\/arcade'/);
  assert.match(radialHome, /BRANCH_COUNT = 8/);
  assert.match(radialHome, /data-dendrite-destination/);
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

test('the Game Network index stays sparse while showing useful release provenance', () => {
  const page = readRepoFile('app/arcade/page.tsx');
  const catalog = readRepoFile('components/arcade/ArcadeCatalog.tsx');

  assert.match(page, />\s*game network\s*</i);
  assert.doesNotMatch(page, /interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);
  assert.match(catalog, /game\.version/);
  assert.match(catalog, /game\.sourceCommit/);
  assert.match(catalog, /game\.subtitle/);
  assert.doesNotMatch(catalog, /game\.description|game\.tags|game\.controls/);
});

test('Game Network browser validation covers the two active cabinets in four engines', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.doesNotMatch(browserTest, /testSylvaria/);
});

test('production game engines stay upstream instead of being duplicated in the website repo', () => {
  assert.equal(existsSync(join(root, 'public/game-runtimes/stretchicorn')), false);
  assert.equal(existsSync(join(root, 'public/game-runtimes/mosslight-v2')), false);

  const stretchicornRoute = readRepoFile('app/game-runtimes/stretchicorn/[...asset]/route.ts');
  const uniricoRoute = readRepoFile('app/game-runtimes/unirico/[...asset]/route.ts');
  const gateway = readRepoFile('lib/arcade/pinnedGithubRuntime.ts');
  assert.match(stretchicornRoute, /servePinnedGithubRuntimeAsset/);
  assert.match(uniricoRoute, /servePinnedGithubRuntimeAsset/);
  assert.match(gateway, /raw\.githubusercontent\.com/);
  assert.match(gateway, /X-Arcade-Upstream-Commit/);
});
