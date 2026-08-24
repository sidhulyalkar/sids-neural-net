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
  '02-control-authority.js',
  '03-render-canopy.js',
  '03-render-fast-underpaint.js',
  '03-render-reference-pass.js',
  '03-render-reference-handoff.js',
  '03-render-altitude-realism.js',
  '03-render-performance.js',
  '03-title-focus-guard.js',
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
const control = read('02-control-authority.js');
const canopy = read('03-render-canopy.js');
const underpaint = read('03-render-fast-underpaint.js');
const referenceRender = read('03-render-reference-pass.js');
const handoff = read('03-render-reference-handoff.js');
const altitudeRender = read('03-render-altitude-realism.js');
const performanceRender = read('03-render-performance.js');
const focusGuard = read('03-title-focus-guard.js');
const input = read('04-input.js');
const runtime = [core, feel, world, gameplay, jumpContract, assist, stick, control, canopy, underpaint, referenceRender, handoff, altitudeRender, performanceRender, focusGuard, input].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.4\.0<\/title>/);
assert.match(index, /02-flow-assist\.js[\s\S]*02-sap-stick\.js[\s\S]*02-control-authority\.js[\s\S]*03-render-canopy\.js[\s\S]*03-render-fast-underpaint\.js[\s\S]*03-render-reference-pass\.js[\s\S]*03-render-reference-handoff\.js[\s\S]*03-render-altitude-realism\.js[\s\S]*03-render-performance\.js[\s\S]*03-title-focus-guard\.js[\s\S]*04-input\.js/);
assert.match(index, /hold Shift \+ tap Space = Sap Stick/i);

assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(core, /MAX_STEPS: 8/);
assert.match(core, /routeRng: makeRng/);
assert.match(core, /fxRng: makeRng/);
assert.match(core, /airJumps: 1/);

for (const pattern of [
  /groundAccel: 3720/,
  /airAccel: 1900/,
  /maxSpeed: 690/,
  /groundFriction60Hz: 0\.91/,
  /airDrag120Hz: 0\.9991/,
  /reverseAirScale: 1\.08/,
  /strideLaunchCarry: 0\.82/,
  /base: 642/,
  /momentumGain: 0\.62/,
  /doubleBase: 515/,
  /wallRefreshSpeed: 99999/,
  /retention: 0\.78/,
  /kickVertical: 710/,
  /stickRange: 640/,
  /stickHoldSeconds: 0\.22/,
  /stickReuseLockSeconds: 0\.82/,
  /stickReleaseMinVy: 630/,
  /window: 3\.35/,
  /baseSpeed: 20/,
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

assert.match(gameplay, /function doGroundJump\(/);
assert.match(gameplay, /function doAirJump\(/);
assert.match(gameplay, /function bounceFromWall\(/);
assert.match(gameplay, /function updateSap\(/);

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

for (const pattern of [
  /velocity-authority-v1/,
  /groundReverseAssist: 1120/,
  /airReverseAssist: 920/,
  /function restorePlayerOwnedLaunch\(/,
  /function applyReverseAuthority\(/,
  /launch-velocity-authority/,
  /Stride is allowed to preserve \*jump height\*/,
  /S\.update = update/,
]) assert.match(control, pattern);

assert.doesNotMatch(canopy, /routeRng\.next\(/, 'canopy renderer must never consume route RNG');
assert.match(canopy, /shared-vertex anisotropic puzzle lattice/);
assert.match(canopy, /S\.render = render/);

for (const pattern of [
  /single-paint-pipeline-v1/,
  /const canopyFallback = S\.render/,
  /forceCanopyFallback/,
  /setCanopyFallback/,
  /S\.render = \(alpha, now\) =>/,
]) assert.match(underpaint, pattern);
assert.doesNotMatch(underpaint, /canopyFallback\(alpha, now\);\s*canopyFallback\(alpha, now\)/, 'underpaint must never duplicate the canopy pass');

assert.doesNotMatch(referenceRender, /routeRng\.next\(/, 'reference renderer must never consume route RNG');
for (const pattern of [
  /reference-production-v1/,
  /function makeBarkTile\(/,
  /function drawReferenceBackground\(/,
  /function drawReferenceTrunk\(/,
  /function drawReferenceBranch\(/,
  /function drawReferencePlayer\(/,
  /function drawReferenceHud\(/,
  /collisionHonest: true/,
  /baseRender\(alpha, now\)/,
  /S\.render = render/,
]) assert.match(referenceRender, pattern);

assert.match(handoff, /referenceRender: S\.render/);
assert.match(handoff, /referenceVersion/);

assert.doesNotMatch(altitudeRender, /routeRng\.next\(/, 'altitude renderer must never consume route RNG');
for (const pattern of [
  /altitude-realism-v1/,
  /function profileForFloor\(/,
  /function drawAtmosphericGrade\(/,
  /function drawTrunkEcology\(/,
  /function drawBranchEcology\(/,
  /continuousBlendFloors: BLEND_FLOORS/,
  /collisionHonest: true/,
  /baseRender\(alpha, now\)/,
]) assert.match(altitudeRender, pattern);

for (const pattern of [
  /feel-first-render-budget-v1/,
  /let quality = 'reference'/,
  /referenceFrames >= 240/,
  /renderCostEwma < 6\.4/,
  /renderCostEwma > 10\.8/,
  /referenceRender\(alpha, now\)/,
  /fullRender\(alpha, now\)/,
  /singlePaint: true/,
  /S\.render = render/,
]) assert.match(performanceRender, pattern);

for (const pattern of [
  /desktop-focus-v1/,
  /function guardDesktopTitleFocus\(/,
  /event\.pointerType === 'touch'/,
  /desktopActivation: 'Space-or-Enter'/,
]) assert.match(focusGuard, pattern);

for (const pattern of [
  /const SHIFT_KEYS = new Set/,
  /function triggerSapStick\(/,
  /event\.code === 'Space' && shiftHeld\(\)/,
  /S\.castSapStick\?\.\(\)/,
  /START_JUMP_GUARD_MS = 80/,
  /SAME_KEY_JUMP_REARM_MS = 82/,
  /pendingActivation/,
  /version: '0\.4\.0'/,
]) assert.match(input, pattern);
assert.doesNotMatch(input, /KeyE|SAP_KEYS/, 'v0.4 canonical Sap Stick input must be Shift+Space');

assert.doesNotMatch(runtime, /\benemy\b|\bdamage\b|\battack\b/i, 'Sequoia runtime should remain traversal-first');
for (const pattern of [
  /Shift \+ Space/i,
  /no charge/i,
  /branchless/i,
  /same-seed/i,
]) assert.match(design, pattern);

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  version: '0.4.0-feel-recovery-single-paint',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX'],
  corridorWidth: 760,
  feel: ['responsive acceleration', 'strong air steering', 'player-owned reversals', 'Stride height memory without hidden horizontal snaps'],
  render: ['single production scene paint', 'reference-first active gameplay', 'budget-gated altitude ecology'],
  sapStick: ['Shift+Space', 'no charge', '0.22s tether', 'auto-vault', 'anchor reuse lock'],
}, null, 2));