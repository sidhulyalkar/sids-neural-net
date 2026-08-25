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
  assert.ok(getArcadeGame('sylvaria-sequoia'));
});

test('legacy exploration-era Sylvaria and Mosslight routes remain inactive', () => {
  const route = readRepoFile('app/arcade/[slug]/page.tsx');
  assert.match(route, /getArcadeGame/);
  assert.match(route, /notFound\(\)/);

  const catalog = readRepoFile('src/data/arcadeGames.ts');
  assert.doesNotMatch(catalog, /slug: 'sylvaria'/);
  assert.doesNotMatch(catalog, /slug: 'mosslight'/);
  assert.doesNotMatch(catalog, /slug === 'mosslight'/);
  assert.match(catalog, /slug: 'sylvaria-sequoia'/);
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

test('uniRico cabinet pins the v0.19.0 release with cache-safe versioned runtime URLs', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'unirico');
  assert.ok(game);
  assert.equal(game.version, 'v0.19.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.repoUrl, 'https://github.com/sidhulyalkar/uniRico');
  assert.equal(game.launchUrl, '/game-runtimes/unirico/v0.19.0/index.html');
  assert.deepEqual(game.nativeSize, { width: 960, height: 600 });
  assert.ok(game.controls.some((control) => control.input === 'AIM wheel'));
  assert.ok(game.controls.some((control) => control.input === 'FIRE'));
  assert.match(game.description, /first-seen mechanic demonstrations/i);
  assert.match(game.description, /precision mobile AIM wheel/i);

  const route = readRepoFile('app/game-runtimes/unirico/[...asset]/route.ts');
  assert.match(route, /UNIRICO_VERSION = 'v0\.19\.0'/);
  assert.match(route, /UNIRICO_SOURCE_COMMIT = '13de2151bb2731557392e3399354ee7e744415f3'/);
  assert.doesNotMatch(route, /5c3737957f302e9c44917097494684419e58e757/);
  assert.match(route, /redirectLegacyAsset/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /X-UniRico-Version/);
  assert.match(route, /X-UniRico-Source-Commit/);
});

test('Sylvaria cabinet exposes v0.6.1 sparse nearest-node Sap, Contracts, and Living Canopy', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria-sequoia');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria: Sequoia');
  assert.equal(game.version, 'v0.6.1');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.launchUrl, '/game-runtimes/sylvaria-sequoia/index.html');
  assert.deepEqual(game.nativeSize, { width: 960, height: 640 });
  assert.match(game.subtitle, /LAND HIGHER/);
  assert.match(game.subtitle, /BRIDGE WITH SAP/);
  assert.match(game.subtitle, /CONTRACTS/);
  assert.match(game.description, /strict nearest eligible unused amber node/i);
  assert.match(game.description, /physically holds a new higher log/i);
  assert.match(game.description, /only a tightly bounded momentum nudge/i);
  assert.match(game.description, /Cone Tokens/);
  assert.match(game.description, /Extra Life/);
  assert.match(game.description, /Living Crown at floor 250/);
  assert.match(game.description, /Skyheart at floor 360/);
  assert.match(game.description, /without permanently raising Pip’s base movement stats/);
  assert.ok(game.controls.some((control) => control.input === 'Land on a new higher log'));
  assert.ok(game.controls.some((control) => control.input === 'Press Shift' && /strict nearest/.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Release Shift' && /small bounded momentum nudge/.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Cone Tokens'));
  assert.ok(game.controls.some((control) => control.input === '3 Canopy Contracts'));
  assert.ok(game.controls.some((control) => control.input === 'B · 1 / 2 / 3 / 4'));
  assert.ok(game.controls.some((control) => control.input === 'Heartseeds 0/5'));
  assert.ok(game.controls.some((control) => control.input === 'Canopy Wonders 0/6'));
  assert.ok(game.controls.some((control) => control.input === 'Skyheart · floor 360'));

  const runtimeRoot = 'public/game-runtimes/sylvaria-sequoia';
  for (const file of [
    'index.html',
    '02-heartwood-quest.js',
    '02-canopy-trials.js',
    '02-living-canopy.js',
    '02-sap-route-balance.js',
    '02-sap-rhythm.js',
    '02-canopy-economy.js',
    '02-sap-authority-v2.js',
    '03-heartwood-trials-render.js',
    '03-living-canopy-render.js',
    '03-living-objective-hud.js',
    '03-canopy-economy-hud.js',
    '03-economy-input-guard.js',
    '05-debug-living-canopy.js',
    '05-debug-canopy-contracts.js',
  ]) {
    assert.ok(existsSync(join(root, runtimeRoot, file)), `missing Sylvaria runtime file ${file}`);
  }
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-flow-envelope.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-heartwood.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-living-canopy.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-economy.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-sap-authority.mjs')));
  assert.ok(existsSync(join(root, 'scripts/playtest-sylvaria-shift-hold.mjs')));
  assert.ok(existsSync(join(root, 'scripts/playtest-sylvaria-heartwood.mjs')));
  assert.ok(existsSync(join(root, 'scripts/playtest-sylvaria-living-canopy-v2.mjs')));
  assert.ok(existsSync(join(root, 'scripts/playtest-sylvaria-economy.mjs')));
  assert.ok(existsSync(join(root, 'scripts/playtest-sylvaria-sap-authority.mjs')));
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

test('Game Network browser validation preserves current cabinets and gives Sylvaria dedicated matrices', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');
  const livingTest = readRepoFile('scripts/playtest-sylvaria-living-canopy-v2.mjs');
  const economyTest = readRepoFile('scripts/playtest-sylvaria-economy.mjs');
  const sapAuthorityTest = readRepoFile('scripts/playtest-sylvaria-sap-authority.mjs');
  const sylvariaWorkflow = readRepoFile('.github/workflows/sylvaria-sequoia-ci.yml');

  assert.match(workflow, /install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.match(browserTest, /uniRico v0\.19\.0/);
  assert.match(browserTest, /AIM release fired unexpectedly/);
  assert.match(livingTest, /name: 'chrome-stable'/);
  assert.match(livingTest, /channel: 'chrome'/);
  assert.match(livingTest, /six-wonder Atlas did not complete/);
  assert.match(livingTest, /Skyheart did not ring persistently/);
  assert.match(economyTest, /name: 'chrome-stable'/);
  assert.match(economyTest, /Sap spam bypassed the higher-log recharge contract/);
  assert.match(economyTest, /Extra Life was not consumed into the next run/);
  assert.match(sapAuthorityTest, /name: 'chrome-stable'/);
  assert.match(sapAuthorityTest, /strict nearest eligible node/);
  assert.match(sapAuthorityTest, /24; index \+= 1/);
  assert.match(sapAuthorityTest, /single-use Sap lease/);
  assert.match(sapAuthorityTest, /bounded momentum nudge/);
  assert.match(sylvariaWorkflow, /check:sylvaria-sap-authority/);
  assert.match(sylvariaWorkflow, /playtest-sylvaria-sap-authority\.mjs/);
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