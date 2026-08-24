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
  '02-sap-stick.js',
  '03-render-canopy.js',
  '03-render-reference-pass.js',
  '04-input.js',
];
const indexPath = join(runtimeRoot, 'index.html');
const designPath = join(root, 'docs/SYLVARIA_SEQUOIA_V04_SAPSTICK_CANOPY_PASS.md');

for (const path of [indexPath, designPath, ...modules.map((name) => join(runtimeRoot, name))]) {
  assert.ok(existsSync(path), `missing Sylvaria: Sequoia v0.4 artifact: ${path}`);
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
const stick = read('02-sap-stick.js');
const render = read('03-render-canopy.js');
const referenceRender = read('03-render-reference-pass.js');
const input = read('04-input.js');
const runtime = [core, feel, world, gameplay, jumpContract, assist, stick, render, referenceRender, input].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.4\.0<\/title>/);
assert.match(index, /02-flow-assist\.js[\s\S]*02-sap-stick\.js[\s\S]*03-render-canopy\.js[\s\S]*03-render-reference-pass\.js[\s\S]*04-input\.js/);
assert.doesNotMatch(index, /03-render\.js|03-stride-hud\.js|03-render-skill-pass\.js/);
assert.match(index, /hold Shift \+ tap Space = Sap Stick/i);
assert.match(index, /sparse branches \+ amber anchor gaps/i);

assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(core, /routeRng: makeRng/);
assert.match(core, /fxRng: makeRng/);
assert.match(core, /airJumps: 1/);

for (const pattern of [
  /groundAccel: 3220/,
  /maxSpeed: 630/,
  /comboAccelCap: 0\.095/,
  /comboCarryCap: 26/,
  /strideLaunchCarry: 0\.61/,
  /base: 612/,
  /doubleBase: 485/,
  /wallRefreshSpeed: 99999/,
  /retention: 0\.55/,
  /comboSpeed: 99999/,
  /stickRange: 640/,
  /stickHoldSeconds: 0\.22/,
  /stickCooldownSeconds: 0\.11/,
  /stickReuseLockSeconds: 0\.82/,
  /stickReleaseMinVy: 610/,
  /stickReleaseForward: 116/,
  /stickAnchorPriority: 108/,
  /window: 2\.80/,
  /easyHyperThreshold: 10/,
]) assert.match(feel, pattern);

for (const grammar of ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX']) {
  assert.match(world, new RegExp(`${grammar}: \\[`), `missing ${grammar} route grammar`);
}
for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
  assert.match(world, new RegExp(phase), `missing ${phase} phase`);
}
assert.match(world, /state\.LEFT_WALL = 100/);
assert.match(world, /state\.RIGHT_WALL = 860/);
assert.match(world, /branch: false/);
assert.match(world, /addKnot\([^\n]+, 'sap-stick'\)/);
assert.match(world, /function airAnchorPosition\(/);
assert.match(world, /SAPRUN[\s\S]*branch: false[\s\S]*branch: false[\s\S]*branch: false/);
assert.match(world, /ROOTWAYS[\s\S]*SAPRUN/);

assert.match(gameplay, /function doAirJump\(/);
assert.match(gameplay, /function bounceFromWall\(/);
assert.match(gameplay, /function updateSap\(/);
assert.match(gameplay, /function attachSap\(/);

assert.match(jumpContract, /duplicateEdgeMs = 48/);
assert.match(jumpContract, /player\.consumedJumpRequestId = activeRequestId/);
assert.match(jumpContract, /action: airJumped \? 'AIR_KICK' : 'GROUND_JUMP'/);

for (const pattern of [
  /function skillSpeedCap\(/,
  /function beginCling\(/,
  /function barkKick\(/,
  /passiveBarkRedirects/,
  /function updateMomentumBurst\(/,
  /function maybeEnterCrownvelocity\(/,
]) assert.match(assist, pattern);

for (const pattern of [
  /function findTarget\(/,
  /function castSapStick\(/,
  /function releaseStick\(/,
  /stickMode: true/,
  /TUNE\.sap\.stickHoldSeconds/,
  /anchorLockouts\.set/,
  /SAP STICK SAVE!/,
  /SAP STICK VAULT · AIR KICK READY/,
  /sapStickCasts/,
  /sapStickVaults/,
  /getTargetPreview/,
]) assert.match(stick, pattern);
assert.doesNotMatch(stick, /charge(?:Seconds|Time)|holdToCharge/i, 'Sap Stick must not require charging');

assert.doesNotMatch(render, /routeRng\.next\(/, 'canopy renderer must never consume route RNG');
for (const pattern of [
  /function hash3\(/,
  /function barkVertex\(/,
  /function traceCell\(/,
  /function drawBarkCell\(/,
  /shared-vertex anisotropic puzzle lattice/,
  /longitudinal tear pattern/,
  /function drawPlayer\(/,
  /Leaf hood/,
  /Big mascot head/,
  /SAP STICK/,
  /hold Shift · tap Space/,
  /S\.render = render/,
  /version: '0\.4\.0'/,
]) assert.match(render, pattern);

assert.doesNotMatch(referenceRender, /routeRng\.next\(/, 'reference renderer must never consume route RNG');
for (const pattern of [
  /reference-production-v1/,
  /function makeBarkTile\(/,
  /pre-rendered layered puzzle flakes with longitudinal microfibers/,
  /function drawReferenceBackground\(/,
  /function drawReferenceTrunk\(/,
  /function drawReferenceBranch\(/,
  /function drawReferenceKnot\(/,
  /function drawReferenceSapline\(/,
  /function drawReferencePlayer\(/,
  /function drawReferenceHud\(/,
  /cinematic twin-sequoia reference layout/,
  /mascot-scale expressive vector climber/,
  /collisionHonest: true/,
  /baseRender\(alpha, now\)/,
  /S\.render = render/,
]) assert.match(referenceRender, pattern);

for (const pattern of [
  /const SHIFT_KEYS = new Set/,
  /function triggerSapStick\(/,
  /event\.code === 'Space' && shiftHeld\(\)/,
  /S\.castSapStick\?\.\(\)/,
  /const physicalDown = new Map\(\)/,
  /START_JUMP_GUARD_MS = 80/,
  /MIN_JUMP_REPRESS_MS = 48/,
  /pendingActivation/,
  /sapChordCount/,
  /version: '0\.4\.0'/,
  /sapAnchorCount/,
  /renderer: S\.canopyRenderer/,
]) assert.match(input, pattern);
assert.doesNotMatch(input, /KeyE|SAP_KEYS/, 'v0.4 canonical Sap Stick input must be Shift+Space');

assert.doesNotMatch(runtime, /\benemy\b|\bdamage\b|\battack\b/i, 'Sequoia runtime should remain traversal-first');
for (const pattern of [
  /Shift \+ Space/i,
  /no charge/i,
  /branchless/i,
  /shared-vertex anisotropic puzzle lattice/i,
  /same-seed/i,
]) assert.match(design, pattern);

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  version: '0.4.0-sapstick-reference-art',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX'],
  corridorWidth: 760,
  sapStick: ['Shift+Space', 'no charge', '0.22s tether', 'auto-vault', 'anchor reuse lock'],
  topology: ['sparse branches', 'branchless amber tiers', 'open Grove chambers'],
  bark: 'shared-vertex puzzle lattice plus pre-rendered production flake overlay',
  art: ['bright valley composition', 'deep sequoia bark', 'organic moss branches', 'amber cavities', 'mascot Pip', 'reference HUD'],
}, null, 2));