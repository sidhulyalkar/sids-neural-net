import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const modules = [
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
const indexPath = join(runtimeRoot, 'index.html');
const designPath = join(root, 'docs/SYLVARIA_SEQUOIA_V03_AERIAL_COMBO_DESIGN.md');

for (const path of [indexPath, designPath, ...modules.map((name) => join(runtimeRoot, name))]) {
  assert.ok(existsSync(path), `missing Sylvaria: Sequoia artifact: ${path}`);
}
for (const moduleName of modules) {
  execFileSync(process.execPath, ['--check', join(runtimeRoot, moduleName)], { stdio: 'pipe' });
}

const read = (name) => readFileSync(join(runtimeRoot, name), 'utf8');
const index = readFileSync(indexPath, 'utf8');
const core = read('00-core.js');
const feel = read('00-feel-tuning.js');
const world = read('01-world.js');
const gameplay = read('02-gameplay.js');
const jumpContract = read('02-jump-contract.js');
const assist = read('02-flow-assist.js');
const legacyRender = read('03-render.js');
const strideHud = read('03-stride-hud.js');
const skillRender = read('03-render-skill-pass.js');
const input = read('04-input.js');
const runtime = [core, feel, world, gameplay, jumpContract, assist, legacyRender, strideHud, skillRender, input].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.3\.0<\/title>/);
assert.match(index, /03-render\.js[\s\S]*03-stride-hud\.js[\s\S]*03-render-skill-pass\.js[\s\S]*04-input\.js/);
assert.match(index, /hold into bark to cling/i);
assert.match(index, /Grove Chambers/i);
assert.doesNotMatch(index, /crownrush|\.\/game\.js/i);

assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(core, /routeRng: makeRng/);
assert.match(core, /fxRng: makeRng/);
assert.match(core, /airJumps: 1/);

// Skill-flow tuning: useful speed without runaway assistance.
for (const pattern of [
  /groundAccel: 3250/,
  /airAccel: 1480/,
  /maxSpeed: 625/,
  /groundFriction60Hz: 0\.885/,
  /airDrag120Hz: 0\.9978/,
  /burstChargeSeconds: 0\.28/,
  /comboAccelCap: 0\.10/,
  /comboCarryBase: 10/,
  /comboCarryCap: 28/,
  /strideMemoryDecay: 176/,
  /strideLaunchCarry: 0\.62/,
  /strideMax: 660/,
  /skillSpeedBonusCap: 82/,
  /base: 610/,
  /momentumGain: 0\.54/,
  /doubleBase: 480/,
  /wallRefreshSpeed: 99999/,
  /retention: 0\.56/,
  /verticalBase: 155/,
  /comboSpeed: 99999/,
  /clingHold: 0\.26/,
  /kickVertical: 690/,
  /attachMax: 430/,
  /quickMinVy: 610/,
  /window: 2\.85/,
  /landingGrace: 0\.92/,
  /easyHyperThreshold: 10/,
  /hyperVarietyThreshold: 6/,
  /baseSpeed: 25/,
]) assert.match(feel, pattern);

for (const grammar of ['FLOW', 'GROVE', 'CRUX', 'RECOVERY', 'SLINGSHOT']) {
  assert.match(world, new RegExp(`${grammar}: \\[`), `missing ${grammar} route grammar`);
}
for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
  assert.match(world, new RegExp(phase), `missing ${phase} phase`);
}
assert.match(world, /state\.LEFT_WALL = 118/);
assert.match(world, /state\.RIGHT_WALL = 842/);
assert.match(world, /ROOTWAYS[\s\S]*floor: 0[\s\S]*pressure: 0\.72/);
assert.match(world, /REDWOOD RUN[\s\S]*floor: 30/);
assert.match(world, /SAPWORK[\s\S]*floor: 70/);
assert.match(world, /HIGH CANOPY[\s\S]*floor: 115/);
assert.match(world, /CROWNLINE[\s\S]*floor: 165/);
assert.match(world, /\{ dy: 102, side: 'right', length: 300, knot: 'cross' \}/);
assert.match(world, /difficulty = clamp\(Math\.max\(0, state\.generatedFloor - 26\) \/ 160/);

assert.match(gameplay, /function doAirJump\(/);
assert.match(gameplay, /function bounceFromWall\(/);
assert.match(gameplay, /if \(incoming >= TUNE\.rebound\.comboSpeed\) addComboLink\('BARK'/);
assert.match(gameplay, /if \(incoming >= TUNE\.jump\.wallRefreshSpeed\) refreshAirJump\('BARK'\)/);
assert.match(gameplay, /function threadRings\(/);
assert.match(gameplay, /function attachSap\(/);

assert.match(jumpContract, /duplicateEdgeMs = 28/);
assert.match(jumpContract, /player\.consumedJumpRequestId = activeRequestId/);
assert.match(jumpContract, /action: airJumped \? 'AIR_KICK' : 'GROUND_JUMP'/);

for (const pattern of [
  /function skillSpeedCap\(/,
  /function beginCling\(/,
  /function maintainCling\(/,
  /function barkKick\(/,
  /BARK CLING · JUMP TO KICK/,
  /BARK KICK · AIR KICK READY/,
  /passiveBarkRedirects/,
  /function updateMomentumBurst\(/,
  /function preUpdateStride\(/,
  /player\.strideMomentum \* TUNE\.run\.strideLaunchCarry/,
  /function applyComboCarry\(/,
  /function maybeEnterCrownvelocity\(/,
  /TUNE\.combo\.easyHyperThreshold/,
  /TUNE\.combo\.hyperVarietyThreshold/,
  /player\.vx = clamp\(player\.vx, -skillSpeedCap\(\), skillSpeedCap\(\)\)/,
]) assert.match(assist, pattern);

assert.doesNotMatch(skillRender, /routeRng\.next\(/, 'final renderer must never consume route RNG');
for (const pattern of [
  /function drawSequoia\(/,
  /function drawPlayer\(/,
  /function drawRing\(/,
  /function drawLaunchBurl\(/,
  /GROVE/,
  /BARK GRIP/,
  /passive bark does not score/,
  /Grove Chambers open the tower/,
  /const sceneScale = state\.reducedMotion \? 1 : 1 - speedWide - hyperWide/,
  /S\.render = render/,
]) assert.match(skillRender, pattern);
assert.match(strideHud, /strideMomentum/);
assert.match(strideHud, /S\.render = render/);

assert.match(input, /window\.SYLVARIA_SEQUOIA_DEBUG/);
assert.match(input, /version: '0\.3\.0'/);
assert.match(input, /fixedHz: 120/);
assert.match(input, /function quarantineStartKey\(/);
assert.match(input, /flowAssist: S\.flowAssist\?\.getState\(\) \|\| null/);

assert.doesNotMatch(runtime, /\benemy\b|\bdamage\b|\battack\b/i, 'Sequoia runtime should remain traversal-first');
assert.match(design, /renewable Air Kick/i);
assert.match(design, /SAP SURGE/);
assert.match(design, /same-seed comparisons/i);
assert.ok(!existsSync(join(root, 'public/game-runtimes/crownrush')));

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  version: '0.3.0-skill-flow-grove-pass',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'GROVE', 'CRUX', 'RECOVERY', 'SLINGSHOT'],
  corridorWidth: 724,
  passiveBark: ['redirect only', 'no Flow', 'no Air Kick refresh'],
  deliberateBark: ['hold toward wall', 'short cling', 'Jump for Bark Kick'],
  art: ['forest depth', 'bark plates', 'moss and fungi', 'new Pip climber', 'collision edge readability'],
}, null, 2));
