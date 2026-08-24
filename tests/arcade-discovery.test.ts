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

test('Sylvaria Sequoia exposes the deliberate skill-flow Grove contract', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria-sequoia');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria: Sequoia');
  assert.equal(game.version, 'v0.3.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.launchUrl, '/game-runtimes/sylvaria-sequoia/index.html');
  assert.equal(game.nativeSize?.width, 960);
  assert.equal(game.nativeSize?.height, 640);
  assert.match(game.description, /Grove Chambers/);
  assert.match(game.description, /route grammars/);
  assert.match(game.description, /passive bark/);
  assert.match(game.description, /Bark Cling/);
  assert.match(game.description, /Bark Kick/);
  assert.match(game.description, /Air Kicks/);
  assert.match(game.description, /Resin Rings/);
  assert.match(game.description, /Sap Snap/);
  assert.match(game.description, /Quick Sling/);
  assert.match(game.description, /SAP SURGE/);
  assert.match(game.description, /CROWNVELOCITY/);
  assert.doesNotMatch(game.description, /enemy|damage|attack/i);

  const runtimeRoot = 'public/game-runtimes/sylvaria-sequoia';
  const runtimeFiles = [
    'index.html',
    '00-core.js',
    '00-feel-tuning.js',
    '01-world.js',
    '02-gameplay.js',
    '02-jump-contract.js',
    '02-flow-assist.js',
    '03-render.js',
    '03-stride-hud.js',
    '03-render-skill-pass.js',
    '04-input.js',
  ];
  for (const file of runtimeFiles) {
    assert.ok(existsSync(join(root, runtimeRoot, file)), `missing Sylvaria Sequoia runtime file: ${file}`);
  }
  assert.ok(existsSync(join(root, 'docs/SYLVARIA_SEQUOIA_V03_AERIAL_COMBO_DESIGN.md')));
  assert.ok(existsSync(join(root, 'docs/SYLVARIA_SEQUOIA_V03_SKILL_FLOW_GROVE_PASS.md')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-sequoia.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-flow-envelope.mjs')));
  assert.ok(!existsSync(join(root, 'public/game-runtimes/crownrush')));

  const core = readRepoFile(`${runtimeRoot}/00-core.js`);
  const feel = readRepoFile(`${runtimeRoot}/00-feel-tuning.js`);
  const world = readRepoFile(`${runtimeRoot}/01-world.js`);
  const gameplay = readRepoFile(`${runtimeRoot}/02-gameplay.js`);
  const flowAssist = readRepoFile(`${runtimeRoot}/02-flow-assist.js`);
  const strideHud = readRepoFile(`${runtimeRoot}/03-stride-hud.js`);
  const skillRender = readRepoFile(`${runtimeRoot}/03-render-skill-pass.js`);
  const input = readRepoFile(`${runtimeRoot}/04-input.js`);

  assert.match(core, /FIXED_DT: 1 \/ 120/);
  assert.match(core, /airJumps: 1/);
  assert.match(feel, /maxSpeed: 625/);
  assert.match(feel, /momentumGain: 0\.54/);
  assert.match(feel, /strideLaunchCarry: 0\.62/);
  assert.match(feel, /comboCarryBase: 10/);
  assert.match(feel, /comboCarryCap: 28/);
  assert.match(feel, /wallRefreshSpeed: 99999/);
  assert.match(feel, /comboSpeed: 99999/);
  assert.match(feel, /clingHold: 0\.26/);
  assert.match(feel, /easyHyperThreshold: 10/);
  assert.match(feel, /hyperVarietyThreshold: 6/);
  assert.match(feel, /sapSurgeThreshold: 5/);
  assert.match(feel, /hyperThreshold: 7/);
  assert.match(feel, /hyperVariety: 3/);

  for (const grammar of ['FLOW', 'GROVE', 'CRUX', 'RECOVERY', 'SLINGSHOT']) {
    assert.match(world, new RegExp(`${grammar}:`));
  }
  for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
    assert.match(world, new RegExp(phase));
  }
  assert.match(world, /state\.LEFT_WALL = 118/);
  assert.match(world, /state\.RIGHT_WALL = 842/);
  assert.match(world, /floor: 30/);
  assert.match(world, /floor: 70/);
  assert.match(world, /floor: 115/);
  assert.match(world, /floor: 165/);
  assert.match(world, /step\.ring/);
  assert.match(world, /step\.launch/);

  assert.match(gameplay, /function doAirJump\(/);
  assert.match(gameplay, /function refreshAirJump\(/);
  assert.match(gameplay, /function addComboLink\(/);
  assert.match(gameplay, /function threadRings\(/);
  assert.match(gameplay, /const surge = player\.combo >= TUNE\.combo\.sapSurgeThreshold/);
  assert.match(gameplay, /function attachSap\(/);
  assert.match(gameplay, /function rescueFromThreat\(/);

  assert.match(flowAssist, /function skillSpeedCap\(/);
  assert.match(flowAssist, /function beginCling\(/);
  assert.match(flowAssist, /function maintainCling\(/);
  assert.match(flowAssist, /!player\.clingActive/);
  assert.match(flowAssist, /passiveBarkRedirects/);
  assert.match(flowAssist, /stride-launch-carry/);
  assert.match(flowAssist, /combo-speed-carry/);
  assert.match(flowAssist, /easyHyperThreshold/);
  assert.match(flowAssist, /'PURE_FLOW'/);
  assert.match(flowAssist, /SAP SNAP/);
  assert.match(flowAssist, /QUICK SLING/);
  assert.match(flowAssist, /BARK CLING · JUMP TO KICK/);
  assert.match(flowAssist, /BARK KICK · AIR KICK READY/);

  assert.match(strideHud, /strideMomentum/);
  assert.match(skillRender, /function drawSequoia\(/);
  assert.match(skillRender, /function drawPlayer\(/);
  assert.match(skillRender, /GROVE/);
  assert.match(skillRender, /BARK GRIP/);
  assert.match(skillRender, /passive bark does not score/);
  assert.match(skillRender, /S\.render = render/);

  assert.match(input, /window\.SYLVARIA_SEQUOIA_DEBUG/);
  assert.match(input, /version: '0\.3\.0'/);
  assert.match(input, /airJumps: player\.airJumps/);
  assert.match(input, /flowAssist: S\.flowAssist/);
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
  assert.match(browserTest, /doubleJumps/);
  assert.match(browserTest, /airJumps/);
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
