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

test('Sylvaria Sequoia exposes the v0.4 one-button Sap Stick feel contract', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria-sequoia');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria: Sequoia');
  assert.equal(game.version, 'v0.4.0');
  assert.equal(game.sourceVisibility, 'public');
  assert.equal(game.launchUrl, '/game-runtimes/sylvaria-sequoia/index.html');
  assert.equal(game.nativeSize?.width, 960);
  assert.equal(game.nativeSize?.height, 640);
  assert.match(game.subtitle, /STICK/);
  assert.match(game.description, /sparse routes/);
  assert.match(game.description, /branchless amber-anchor/);
  assert.match(game.description, /Bark Cling/);
  assert.match(game.description, /Bark Kick/);
  assert.match(game.description, /one-button movement tool/);
  assert.match(game.description, /press Shift/);
  assert.match(game.description, /hold Shift/);
  assert.match(game.description, /release Shift/);
  assert.match(game.description, /short acquisition buffer/);
  assert.match(game.description, /Air Kick/);
  assert.match(game.description, /SAPRUN/);
  assert.match(game.description, /puzzle-fit sequoia bark/);
  assert.match(game.description, /mascot-style Pip/);
  assert.match(game.description, /ROOTWAYS/);
  assert.match(game.description, /HIGH CANOPY/);
  assert.match(game.description, /CROWNLINE/);
  assert.match(game.description, /cloud wisps and distant birds/);
  assert.doesNotMatch(game.description, /enemy|damage|attack/i);
  assert.ok(game.controls.some((control) => control.input === 'Press Shift'));
  assert.ok(game.controls.some((control) => control.input === 'Hold Shift + steer'));
  assert.ok(game.controls.some((control) => control.input === 'Release Shift'));
  assert.ok(game.controls.some((control) => control.input === '0 · N · P'));
  assert.ok(!game.controls.some((control) => /Shift \+ Space|Shift · E/.test(control.input)));

  const runtimeRoot = 'public/game-runtimes/sylvaria-sequoia';
  const runtimeFiles = [
    'index.html',
    '00-core.js',
    '00-feel-tuning.js',
    '01-world.js',
    '02-gameplay.js',
    '02-jump-contract.js',
    '02-flow-assist.js',
    '02-sap-stick.js',
    '02-control-authority.js',
    '03-render-canopy.js',
    '03-render-fast-underpaint.js',
    '03-render-reference-pass.js',
    '03-render-reference-handoff.js',
    '03-render-altitude-realism.js',
    '03-render-performance.js',
    '03-sap-stick-control-hud.js',
    '03-title-focus-guard.js',
    '04-input.js',
  ];
  for (const file of runtimeFiles) {
    assert.ok(existsSync(join(root, runtimeRoot, file)), `missing Sylvaria Sequoia runtime file: ${file}`);
  }
  assert.ok(existsSync(join(root, 'docs/SYLVARIA_SEQUOIA_V04_SAPSTICK_CANOPY_PASS.md')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-sequoia.mjs')));
  assert.ok(existsSync(join(root, 'scripts/validate-sylvaria-flow-envelope.mjs')));
  assert.ok(!existsSync(join(root, 'public/game-runtimes/crownrush')));

  const index = readRepoFile(`${runtimeRoot}/index.html`);
  const core = readRepoFile(`${runtimeRoot}/00-core.js`);
  const feel = readRepoFile(`${runtimeRoot}/00-feel-tuning.js`);
  const world = readRepoFile(`${runtimeRoot}/01-world.js`);
  const gameplay = readRepoFile(`${runtimeRoot}/02-gameplay.js`);
  const flowAssist = readRepoFile(`${runtimeRoot}/02-flow-assist.js`);
  const sapStick = readRepoFile(`${runtimeRoot}/02-sap-stick.js`);
  const control = readRepoFile(`${runtimeRoot}/02-control-authority.js`);
  const canopyRender = readRepoFile(`${runtimeRoot}/03-render-canopy.js`);
  const fastUnderpaint = readRepoFile(`${runtimeRoot}/03-render-fast-underpaint.js`);
  const referenceRender = readRepoFile(`${runtimeRoot}/03-render-reference-pass.js`);
  const referenceHandoff = readRepoFile(`${runtimeRoot}/03-render-reference-handoff.js`);
  const altitudeRender = readRepoFile(`${runtimeRoot}/03-render-altitude-realism.js`);
  const performanceRender = readRepoFile(`${runtimeRoot}/03-render-performance.js`);
  const sapHud = readRepoFile(`${runtimeRoot}/03-sap-stick-control-hud.js`);
  const focusGuard = readRepoFile(`${runtimeRoot}/03-title-focus-guard.js`);
  const input = readRepoFile(`${runtimeRoot}/04-input.js`);

  assert.match(index, /v0\.4\.0/);
  assert.match(index, /Shift fires Sap Stick, hold \+ A\/D to swing, release to vault/);
  assert.match(index, /02-sap-stick\.js[\s\S]*02-control-authority\.js/);
  assert.match(index, /03-render-performance\.js[\s\S]*03-sap-stick-control-hud\.js[\s\S]*03-title-focus-guard\.js[\s\S]*04-input\.js/);
  assert.doesNotMatch(index, /03-render-skill-pass\.js|03-stride-hud\.js/);

  assert.match(core, /FIXED_DT: 1 \/ 120/);
  assert.match(core, /airJumps: 1/);
  assert.match(feel, /groundAccel: 3720/);
  assert.match(feel, /airAccel: 1900/);
  assert.match(feel, /maxSpeed: 690/);
  assert.match(feel, /groundFriction60Hz: 0\.91/);
  assert.match(feel, /airDrag120Hz: 0\.9991/);
  assert.match(feel, /reverseAirScale: 1\.08/);
  assert.match(feel, /momentumGain: 0\.62/);
  assert.match(feel, /strideLaunchCarry: 0\.82/);
  assert.match(feel, /comboCarryCap: 48/);
  assert.match(feel, /retention: 0\.78/);
  assert.match(feel, /wallRefreshSpeed: 99999/);
  assert.match(feel, /comboSpeed: 99999/);
  assert.match(feel, /stickRange: 640/);
  assert.match(feel, /stickAcquireBufferSeconds: 0\.18/);
  assert.match(feel, /stickMinHoldSeconds: 0\.075/);
  assert.match(feel, /stickMaxHoldSeconds: 1\.35/);
  assert.match(feel, /stickSteerAccel: 2450/);
  assert.match(feel, /stickReuseLockSeconds: 0\.82/);
  assert.match(feel, /stickReleaseMinVy: 630/);
  assert.match(feel, /window: 3\.35/);
  assert.match(feel, /baseSpeed: 20/);
  assert.doesNotMatch(feel, /stickHoldSeconds: 0\.22/);

  for (const grammar of ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX']) {
    assert.match(world, new RegExp(`${grammar}:`));
  }
  for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
    assert.match(world, new RegExp(phase));
  }
  assert.match(world, /state\.LEFT_WALL = 100/);
  assert.match(world, /state\.RIGHT_WALL = 860/);
  assert.match(world, /branch: false/);
  assert.match(world, /addKnot\([^\n]+, 'sap-stick'\)/);
  assert.match(world, /SAPRUN[\s\S]*branch: false[\s\S]*branch: false[\s\S]*branch: false/);

  assert.match(gameplay, /function doAirJump\(/);
  assert.match(gameplay, /function refreshAirJump\(/);
  assert.match(gameplay, /function addComboLink\(/);
  assert.match(gameplay, /function threadRings\(/);
  assert.match(gameplay, /function updateSap\(/);

  assert.match(flowAssist, /function skillSpeedCap\(/);
  assert.match(flowAssist, /function beginCling\(/);
  assert.match(flowAssist, /function maintainCling\(/);
  assert.match(flowAssist, /passiveBarkRedirects/);
  assert.match(flowAssist, /stride-launch-carry/);
  assert.match(flowAssist, /combo-speed-carry/);

  assert.match(sapStick, /function findTarget\(/);
  assert.match(sapStick, /function pressSapStick\(/);
  assert.match(sapStick, /function releaseSapStickInput\(/);
  assert.match(sapStick, /function applyHeldScreenSteering\(/);
  assert.match(sapStick, /stickHeld = true/);
  assert.match(sapStick, /acquireBuffer = TUNE\.sap\.stickAcquireBufferSeconds/);
  assert.match(sapStick, /suppressLegacyPump/);
  assert.match(sapStick, /SHIFT_RELEASE/);
  assert.match(sapStick, /sapStickBufferedLocks/);
  assert.match(sapStick, /sapStickHoldReleases/);
  assert.match(sapStick, /stickMode: true/);
  assert.match(sapStick, /anchorLockouts/);
  assert.doesNotMatch(sapStick, /holdToCharge|chargeSeconds|AUTO'\)/i);

  assert.match(control, /velocity-authority-v2/);
  assert.match(control, /groundReverseAssist: 1120/);
  assert.match(control, /airReverseAssist: 920/);
  assert.match(control, /function prepareStrideHeightCarry\(/);
  assert.match(control, /function restoreStrideHeightCarry\(/);
  assert.match(control, /stride-height-carry/);
  assert.match(control, /player-owned horizontal velocity; Stride carries vertical opportunity only/);
  assert.match(control, /S\.update = update/);

  assert.match(canopyRender, /function hash3\(/);
  assert.match(canopyRender, /function barkVertex\(/);
  assert.match(canopyRender, /function drawBarkCell\(/);
  assert.match(canopyRender, /shared-vertex anisotropic puzzle lattice/);
  assert.match(canopyRender, /Big mascot head/);
  assert.match(canopyRender, /Leaf hood/);
  assert.match(canopyRender, /SAP STICK/);
  assert.match(canopyRender, /S\.render = render/);
  assert.doesNotMatch(canopyRender, /routeRng\.next\(/);

  assert.match(fastUnderpaint, /single-paint-pipeline-v1/);
  assert.match(fastUnderpaint, /const canopyFallback = S\.render/);
  assert.match(fastUnderpaint, /forceCanopyFallback/);
  assert.match(fastUnderpaint, /setCanopyFallback/);

  assert.match(referenceRender, /reference-production-v1/);
  assert.match(referenceRender, /function makeBarkTile\(/);
  assert.match(referenceRender, /function drawReferenceTrunk\(/);
  assert.match(referenceRender, /function drawReferenceBranch\(/);
  assert.match(referenceRender, /function drawReferenceKnot\(/);
  assert.match(referenceRender, /function drawReferenceSapline\(/);
  assert.match(referenceRender, /function drawReferencePlayer\(/);
  assert.match(referenceRender, /function drawReferenceHud\(/);
  assert.match(referenceRender, /cinematic twin-sequoia reference layout/);
  assert.match(referenceRender, /collisionHonest: true/);
  assert.match(referenceRender, /S\.render = render/);
  assert.doesNotMatch(referenceRender, /routeRng\.next\(/);

  assert.match(referenceHandoff, /referenceRender: S\.render/);

  assert.match(altitudeRender, /altitude-realism-v1/);
  assert.match(altitudeRender, /humid understory/);
  assert.match(altitudeRender, /sunlit trunk corridor/);
  assert.match(altitudeRender, /amber resin belt/);
  assert.match(altitudeRender, /cold blue windline/);
  assert.match(altitudeRender, /open crown and cloud sea/);
  assert.match(altitudeRender, /function drawAtmosphericGrade\(/);
  assert.match(altitudeRender, /function drawTrunkEcology\(/);
  assert.match(altitudeRender, /function drawBranchEcology\(/);
  assert.match(altitudeRender, /function drawUpperCanopyLife\(/);
  assert.match(altitudeRender, /moss yields to lichen and needles/);
  assert.match(altitudeRender, /collisionHonest: true/);
  assert.match(altitudeRender, /S\.render = render/);
  assert.doesNotMatch(altitudeRender, /routeRng\.next\(/);

  assert.match(performanceRender, /feel-first-render-budget-v1/);
  assert.match(performanceRender, /let quality = 'reference'/);
  assert.match(performanceRender, /referenceFrames >= 240/);
  assert.match(performanceRender, /renderCostEwma < 6\.4/);
  assert.match(performanceRender, /renderCostEwma > 10\.8/);
  assert.match(performanceRender, /referenceRender\(alpha, now\)/);
  assert.match(performanceRender, /singlePaint: true/);

  assert.match(sapHud, /shift-hold-v1/);
  assert.match(sapHud, /PRESS = FIRE/);
  assert.match(sapHud, /HOLD \+ A\/D = SWING/);
  assert.match(sapHud, /RELEASE = VAULT/);
  assert.match(sapHud, /resetKey: '0'/);
  assert.match(sapHud, /S\.render = render/);

  assert.match(focusGuard, /desktop-focus-v1/);
  assert.match(focusGuard, /function guardDesktopTitleFocus\(/);
  assert.match(focusGuard, /event\.pointerType === 'touch'/);
  assert.match(focusGuard, /event\.stopImmediatePropagation\(\)/);
  assert.match(focusGuard, /desktopActivation: 'Space-or-Enter'/);

  assert.match(input, /version: '0\.4\.0'/);
  assert.match(input, /const SHIFT_KEYS/);
  assert.match(input, /const RESET_KEYS = new Set\(\['Digit0', 'Numpad0'\]\)/);
  assert.match(input, /function triggerSapStickPress\(/);
  assert.match(input, /S\.pressSapStick/);
  assert.match(input, /releaseSapStick\('SHIFT_RELEASE'\)/);
  assert.match(input, /releaseSapStick\('BLUR'\)/);
  assert.match(input, /sapPressCount/);
  assert.match(input, /sapAnchorCount/);
  assert.doesNotMatch(input, /event\.code === 'KeyR'/);
  assert.doesNotMatch(input, /event\.code === 'Space' && shiftHeld\(\)/);
  assert.doesNotMatch(input, /KeyE|SAP_KEYS/);
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
  assert.match(browserTest, /consumedJumpRequestId/);
  assert.match(browserTest, /airJumps/);
  assert.match(browserTest, /sapChordCount/);
  assert.match(browserTest, /sapStickVaults/);
  assert.match(browserTest, /getSapTarget/);
  assert.doesNotMatch(browserTest, /testCrownrush/);
});