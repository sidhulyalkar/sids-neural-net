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
  '02-canopy-escalation.js',
  '02-canopy-progression.js',
  '02-heartwood-quest.js',
  '02-canopy-trials.js',
  '03-render-canopy.js',
  '03-render-fast-underpaint.js',
  '03-render-reference-pass.js',
  '03-render-reference-handoff.js',
  '03-render-altitude-realism.js',
  '03-render-performance.js',
  '03-minimal-hud-gate.js',
  '03-sap-stick-control-hud.js',
  '03-heartwood-trials-render.js',
  '03-canopy-progress-hud.js',
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
const escalation = read('02-canopy-escalation.js');
const progression = read('02-canopy-progression.js');
const heartwood = read('02-heartwood-quest.js');
const trials = read('02-canopy-trials.js');
const canopy = read('03-render-canopy.js');
const underpaint = read('03-render-fast-underpaint.js');
const referenceRender = read('03-render-reference-pass.js');
const handoff = read('03-render-reference-handoff.js');
const altitudeRender = read('03-render-altitude-realism.js');
const performanceRender = read('03-render-performance.js');
const hudGate = read('03-minimal-hud-gate.js');
const sapHud = read('03-sap-stick-control-hud.js');
const heartwoodRender = read('03-heartwood-trials-render.js');
const progressHud = read('03-canopy-progress-hud.js');
const focusGuard = read('03-title-focus-guard.js');
const input = read('04-input.js');
const runtime = [
  core, feel, world, gameplay, jumpContract, assist, stick, control, escalation, progression,
  heartwood, trials, canopy, underpaint, referenceRender, handoff, altitudeRender, performanceRender,
  hudGate, sapHud, heartwoodRender, progressHud, focusGuard, input,
].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.4\.0<\/title>/);
assert.match(index, /02-flow-assist\.js[\s\S]*02-sap-stick\.js[\s\S]*02-control-authority\.js[\s\S]*02-canopy-escalation\.js[\s\S]*02-canopy-progression\.js[\s\S]*02-heartwood-quest\.js[\s\S]*02-canopy-trials\.js/);
assert.match(index, /03-render-performance\.js[\s\S]*03-minimal-hud-gate\.js[\s\S]*03-sap-stick-control-hud\.js[\s\S]*03-heartwood-trials-render\.js[\s\S]*03-canopy-progress-hud\.js[\s\S]*03-title-focus-guard\.js[\s\S]*04-input\.js/);
assert.match(index, /Shift fires Sap Stick, hold \+ A\/D to swing, release to vault/i);
assert.match(index, /Crown marks every 25 floors/i);
assert.match(index, /find 5 Heartseeds/i);
assert.match(index, /Living Crown at 250/i);
assert.match(index, /0 resets/i);

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
  /stickAcquireBufferSeconds: 0\.18/,
  /stickMinHoldSeconds: 0\.075/,
  /stickMaxHoldSeconds: 1\.35/,
  /stickSteerAccel: 2450/,
  /stickReuseLockSeconds: 0\.82/,
  /stickReleaseMinVy: 630/,
  /window: 3\.35/,
  /baseSpeed: 20/,
]) assert.match(feel, pattern);
assert.doesNotMatch(feel, /stickHoldSeconds: 0\.22/);

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
  /function pressSapStick\(/,
  /function releaseSapStickInput\(/,
  /function applyHeldScreenSteering\(/,
  /stickMode: true/,
  /stickHeld = true/,
  /acquireBuffer = TUNE\.sap\.stickAcquireBufferSeconds/,
  /TUNE\.sap\.stickMinHoldSeconds/,
  /TUNE\.sap\.stickMaxHoldSeconds/,
  /suppressLegacyPump/,
  /anchorLockouts\.set/,
  /SAP STICK · HOLD TO SWING/,
  /SAP VAULT · AIR KICK READY/,
  /CLEAN SAP/,
  /CLEAN_VAULT_MIN_HOLD = 0\.16/,
  /CLEAN_VAULT_MAX_HOLD = 0\.82/,
  /CLEAN_VAULT_MIN_HORIZONTAL = 330/,
  /Number\.POSITIVE_INFINITY/,
  /sapStickCasts/,
  /sapStickBufferedLocks/,
  /sapStickHoldReleases/,
  /sapStickCleanVaults/,
  /sapStickFlowCarries/,
  /sapStickVaults/,
  /getTargetPreview/,
]) assert.match(stick, pattern);
assert.doesNotMatch(stick, /S\.addComboLink\('SAP', 'SAP STICK'/, 'ordinary one-button Sap vaults must not mint Flow');
assert.doesNotMatch(stick, /charge(?:Seconds|Time)|holdToCharge/i, 'Sap Stick must remain no-charge');
assert.doesNotMatch(stick, /sap\.age >= TUNE\.sap\.stickHoldSeconds/);

for (const pattern of [
  /velocity-authority-v2/,
  /groundReverseAssist: 1120/,
  /airReverseAssist: 920/,
  /function prepareStrideHeightCarry\(/,
  /function restoreStrideHeightCarry\(/,
  /function applyReverseAuthority\(/,
  /stride-height-carry/,
  /vertical energy is restored/,
  /S\.update = update/,
]) assert.match(control, pattern);

for (const grammar of ['WINDLINE', 'SKYHOOK', 'CROWNWEAVE']) {
  assert.match(escalation, new RegExp(`${grammar}: \\[`), `missing late-game ${grammar} grammar`);
}
for (const pattern of [
  /canopy-escalation-v1/,
  /if \(floor < 46\) return 0/,
  /lerp\(72, 520, intensity\)/,
  /windReversals/,
  /windExposure/,
  /canopy-wind-reversal/,
  /high\.geometry = Math\.max\(high\.geometry, 0\.82\)/,
  /high\.pressure = Math\.max\(high\.pressure, 1\.17\)/,
  /crown\.geometry = Math\.max\(crown\.geometry, 1\.08\)/,
  /crown\.pressure = Math\.max\(crown\.pressure, 1\.34\)/,
]) assert.match(escalation, pattern);
assert.doesNotMatch(escalation, /state\.routeRng\.next\(/, 'wind must remain deterministic without consuming route RNG');

for (const pattern of [
  /crown-trail-v1/,
  /CROWN_INTERVAL = 25/,
  /sylvaria\.sequoia\.bestFloor/,
  /sylvaria\.sequoia\.bestCombo/,
  /function awardCrownMark\(/,
  /CROWN MARK/,
  /personalBestFloors/,
  /routesCleared/,
  /route-clear-bonus/,
  /S\.markRouteProgress = markRouteProgress/,
]) assert.match(progression, pattern);

for (const pattern of [
  /heartwood-quest-v1/,
  /FINAL_CROWN_FLOOR = 250/,
  /ROOTLIGHT[\s\S]*floor: 22/,
  /CROWNCORE[\s\S]*floor: 218/,
  /sylvaria\.sequoia\.heartseedMask/,
  /living-crown-awakened/,
  /S\.heartwoodQuest =/,
]) assert.match(heartwood, pattern);
assert.doesNotMatch(heartwood, /state\.routeRng\.next\(/, 'Heartseed placement must not consume route RNG');

for (const grammar of ['BREAKAWAY', 'PENDULUM', 'CONEFALL', 'THUNDERCROWN']) {
  assert.match(trials, new RegExp(`${grammar}: \\[`), `missing canopy trial ${grammar}`);
}
for (const pattern of [
  /canopy-trials-v1/,
  /fragile-branch-break/,
  /_trialSway/,
  /function spawnCone\(/,
  /cone-hit/,
  /S\.canopyTrials =/,
]) assert.match(trials, pattern);
assert.doesNotMatch(trials, /state\.routeRng\.next\(/, 'canopy trials must not consume route RNG');

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
  /reference-hud-suppression-v1/,
  /paintMethods/,
  /translate\(22, 18/,
  /state\.mode === 'playing'/,
  /preservesUnderlyingScene: true/,
  /finally/,
]) assert.match(hudGate, pattern);

for (const pattern of [
  /shift-hold-minimal-v2/,
  /SHIFT FIRE/,
  /HOLD \+ A\/D SWING/,
  /RELEASE VAULT/,
  /no persistent side panels/,
  /resetKey: '0'/,
  /S\.render = render/,
]) assert.match(sapHud, pattern);

for (const pattern of [
  /heartwood-trials-render-v1/,
  /function drawFragileBranches\(/,
  /function drawSwayTrails\(/,
  /function drawCones\(/,
  /function drawHeartseed\(/,
  /function drawLivingCrown\(/,
  /S\.render = render/,
]) assert.match(heartwoodRender, pattern);
assert.doesNotMatch(heartwoodRender, /routeRng\.next\(/, 'Heartwood renderer must not consume route RNG');

for (const pattern of [
  /minimal-crown-hud-v1/,
  /heartwood-objective-v2/,
  /function drawWind\(/,
  /function drawCrownGate\(/,
  /function drawMinimalHud\(/,
  /HEARTSEEDS/,
  /LIVING CROWN/,
  /CROWN/,
  /PB/,
  /title fades out after play starts/,
  /edge-free top ribbon \+ world-space crown markers/,
  /S\.render = render/,
]) assert.match(progressHud, pattern);

for (const pattern of [
  /desktop-focus-v1/,
  /function guardDesktopTitleFocus\(/,
  /event\.pointerType === 'touch'/,
  /desktopActivation: 'Space-or-Enter'/,
]) assert.match(focusGuard, pattern);

for (const pattern of [
  /const SHIFT_KEYS = new Set/,
  /const RESET_KEYS = new Set\(\['Digit0', 'Numpad0'\]\)/,
  /function triggerSapStickPress\(/,
  /S\.pressSapStick\?\.\(\)/,
  /releaseSapStick\('SHIFT_RELEASE'\)/,
  /releaseSapStick\('POINTER_RELEASE'\)/,
  /releaseSapStick\('BLUR'\)/,
  /START_JUMP_GUARD_MS = 80/,
  /SAME_KEY_JUMP_REARM_MS = 82/,
  /sapPressCount/,
  /pendingActivation/,
  /version: '0\.4\.0'/,
]) assert.match(input, pattern);
assert.doesNotMatch(input, /event\.code === 'KeyR'/, 'R must not reset near the movement cluster');
assert.doesNotMatch(input, /event\.code === 'Space' && shiftHeld\(\)/, 'Sap Stick must not require a Shift+Space chord');
assert.doesNotMatch(input, /KeyE|SAP_KEYS/);

assert.doesNotMatch(runtime, /\benemy\b|\bdamage\b|\battack\b/i, 'Sequoia runtime should remain traversal-first');
for (const pattern of [
  /press Shift/i,
  /hold Shift/i,
  /release Shift/i,
  /no charge/i,
  /branchless/i,
  /same-seed/i,
  /0 key/i,
  /Crown Mark/i,
  /crosswind/i,
  /Clean Sap/i,
  /Heartseed/i,
  /Living Crown/i,
  /BREAKAWAY/i,
  /PENDULUM/i,
  /CONEFALL/i,
  /THUNDERCROWN/i,
]) assert.match(design, pattern);

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  version: '0.4.0-heartwood-canopy-trials',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX', 'WINDLINE', 'SKYHOOK', 'CROWNWEAVE', 'BREAKAWAY', 'PENDULUM', 'CONEFALL', 'THUNDERCROWN'],
  corridorWidth: 760,
  feel: ['responsive acceleration', 'strong air steering', 'player-owned reversals', 'Stride height memory without hidden horizontal snaps'],
  progression: ['Crown Mark every 25 floors', 'five persistent Heartseeds', 'Living Crown at floor 250', 'persistent height PB', 'route-clear bonuses'],
  difficulty: ['shorter late branches', 'branchless anchor chains', 'deterministic altitude crosswind', 'fragile branches', 'moving Sap anchors', 'telegraphed falling cones', 'rising pressure'],
  render: ['single production scene paint', 'legacy gameplay HUD paint suppression', 'minimal top ribbon', 'world-space Crown markers', 'Heartseed ornaments', 'brief title fade'],
  sapStick: ['press Shift to fire', '180ms acquisition buffer', 'hold plus A/D to swing', 'release Shift to vault', 'Clean Sap earns Flow', 'ordinary Sap only carries Flow'],
  reset: '0 / Numpad0',
}, null, 2));
