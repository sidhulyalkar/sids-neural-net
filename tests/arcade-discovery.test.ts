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

test('the Game Network exposes the three currently active games', () => {
  assert.deepEqual(
    arcadeGames.map((game) => game.slug),
    ['stretchicorn', 'unirico', 'sylvaria-sequoia']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }

  assert.equal(getArcadeGame('sylvaria'), undefined);
  assert.equal(getArcadeGame('mosslight'), undefined);
  assert.equal(getArcadeGame('crownrush'), undefined);
});

test('the shelved exploration-era Sylvaria and Mosslight cabinets stay inactive', () => {
  const route = readRepoFile('app/arcade/[slug]/page.tsx');
  assert.match(route, /getArcadeGame/);
  assert.match(route, /notFound\(\)/);

  const catalog = readRepoFile('src/data/arcadeGames.ts');
  assert.doesNotMatch(catalog, /slug: 'sylvaria'/);
  assert.doesNotMatch(catalog, /slug: 'mosslight'/);
  assert.doesNotMatch(catalog, /slug: 'crownrush'/);
  assert.ok(getArcadeGame('sylvaria-sequoia'));
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

test('Sylvaria Sequoia is a traversal-first kinetic cabinet with telemetry', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria-sequoia');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria: Sequoia');
  assert.equal(game.version, 'v0.2.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.launchUrl, '/game-runtimes/sylvaria-sequoia/index.html');
  assert.equal(game.nativeSize?.width, 960);
  assert.equal(game.nativeSize?.height, 640);
  assert.match(game.description, /Sapline/);
  assert.match(game.description, /CROWNVELOCITY/);
  assert.match(game.description, /route grammars/);
  assert.doesNotMatch(game.description, /enemy|damage|attack/i);

  const runtimeRoot = 'public/game-runtimes/sylvaria-sequoia';
  for (const file of ['index.html', '00-core.js', '01-world.js', '02-gameplay.js', '03-render.js', '04-input.js']) {
    assert.ok(existsSync(join(root, runtimeRoot, file)), `missing Sylvaria Sequoia runtime file: ${file}`);
  }
  assert.ok(existsSync(join(root, 'docs/SYLVARIA_SEQUOIA_V02_DESIGN.md')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-sequoia.mjs')));
  assert.ok(!existsSync(join(root, 'public/game-runtimes/crownrush')));

  const core = readRepoFile(`${runtimeRoot}/00-core.js`);
  const world = readRepoFile(`${runtimeRoot}/01-world.js`);
  const gameplay = readRepoFile(`${runtimeRoot}/02-gameplay.js`);
  const input = readRepoFile(`${runtimeRoot}/04-input.js`);
  assert.match(core, /FIXED_DT: 1 \/ 120/);
  assert.match(core, /hyperThreshold: 4/);
  assert.match(world, /FLOW:/);
  assert.match(world, /CRUX:/);
  assert.match(world, /RECOVERY:/);
  assert.match(world, /SLINGSHOT:/);
  assert.match(gameplay, /function attachSap\(/);
  assert.match(gameplay, /function rescueFromThreat\(/);
  assert.match(input, /window\.SYLVARIA_SEQUOIA_DEBUG/);
});

test('FRONTIER and Game Network coexist in current navigation', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/frontier' && item.label === 'FRONTIER'));
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/frontier'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  const home = readRepoFile('app/page.tsx');
  assert.match(home, /href: '\/frontier'/);
  assert.match(home, /href: '\/arcade'/);
  assert.match(home, /ariaLabel: 'Open FRONTIER personal intelligence radar'/);
  assert.match(home, /ariaLabel: 'Open the Game Network'/);
  assert.match(home, /DendriticPortalLink/);
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

test('Game Network browser validation covers all three active cabinets in four engines', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.match(browserTest, /testSylvariaSequoia\(page, engineName\)/);
  assert.doesNotMatch(browserTest, /testCrownrush/);
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
