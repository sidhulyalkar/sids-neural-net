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

const index = readFileSync(indexPath, 'utf8');
const core = readFileSync(join(runtimeRoot, '00-core.js'), 'utf8');
const feel = readFileSync(join(runtimeRoot, '00-feel-tuning.js'), 'utf8');
const world = readFileSync(join(runtimeRoot, '01-world.js'), 'utf8');
const gameplay = readFileSync(join(runtimeRoot, '02-gameplay.js'), 'utf8');
const jumpContract = readFileSync(join(runtimeRoot, '02-jump-contract.js'), 'utf8');
const flowAssist = readFileSync(join(runtimeRoot, '02-flow-assist.js'), 'utf8');
const render = readFileSync(join(runtimeRoot, '03-render.js'), 'utf8');
const input = readFileSync(join(runtimeRoot, '04-input.js'), 'utf8');
const runtime = [core, feel, world, gameplay, jumpContract, flowAssist, render, input].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.3\.0<\/title>/);
assert.match(index, /<canvas id="c" width="960" height="640"/);
assert.match(index, /00-core\.js[\s\S]*00-feel-tuning\.js[\s\S]*01-world\.js[\s\S]*02-gameplay\.js[\s\S]*02-jump-contract\.js[\s\S]*02-flow-assist\.js[\s\S]*03-render\.js[\s\S]*04-input\.js/);
assert.match(index, /air kick/i);
assert.match(index, /Sap Snap/i);
assert.match(index, /Bark Kick/i);
assert.doesNotMatch(index, /crownrush|\.\/game\.js/i);

assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(core, /routeRng: makeRng/);
assert.match(core, /fxRng: makeRng/);
assert.match(core, /airJumps: 1/);
assert.match(core, /doubleJumps/);
assert.match(core, /airJumpRefreshes/);
assert.match(core, /ringsThreaded/);
assert.match(core, /sapSurges/);
assert.match(core, /comboLinkIntervals/);
assert.match(core, /routeStats/);

// Easy-to-enter momentum loop.
assert.match(feel, /groundAccel: 3680/);
assert.match(feel, /airAccel: 1760/);
assert.match(feel, /maxSpeed: 700/);
assert.match(feel, /groundFriction60Hz: 0\.91/);
assert.match(feel, /burstChargeSeconds: 0\.18/);
assert.match(feel, /burstMinSpeed: 175/);
assert.match(feel, /comboCarryBase: 34/);
assert.match(feel, /strideLaunchCarry: 0\.90/);
assert.match(feel, /strideMax: 760/);
assert.match(feel, /base: 650/);
assert.match(feel, /momentumGain: 0\.65/);
assert.match(feel, /momentumCap: 455/);
assert.match(feel, /cutDrag120Hz: 0\.9993/);
assert.match(feel, /bufferSeconds: 0\.19/);
assert.match(feel, /doubleBase: 520/);
assert.match(feel, /retention: 0\.80/);
assert.match(feel, /verticalBase: 390/);
assert.match(feel, /clingGrace: 0\.22/);
assert.match(feel, /attachMax: 468/);
assert.match(feel, /snapMinVy: 480/);
assert.match(feel, /quickMinVy: 690/);
assert.match(feel, /sapSurgeThreshold: 5/);
assert.match(feel, /hyperThreshold: 7/);
assert.match(feel, /easyHyperThreshold: 6/);
assert.match(feel, /hyperVarietyThreshold: 4/);
assert.match(feel, /window: 3\.70/);
assert.match(feel, /baseSpeed: 18/);

for (const grammar of ['FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT']) {
  assert.match(world, new RegExp(`${grammar}: \\[`), `missing ${grammar} route grammar`);
}
for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
  assert.match(world, new RegExp(phase), `missing ${phase} difficulty phase`);
}
assert.match(world, /ROOTWAYS[\s\S]*floor: 0[\s\S]*pressure: 0\.58/);
assert.match(world, /REDWOOD RUN[\s\S]*floor: 44/);
assert.match(world, /SAPWORK[\s\S]*floor: 90/);
assert.match(world, /HIGH CANOPY[\s\S]*floor: 145/);
assert.match(world, /CROWNLINE[\s\S]*floor: 205/);
assert.match(world, /\{ dy: 54, side: 'center', length: 620, launch: true \}/);
assert.match(world, /\{ dy: 52, side: 'center', length: 640, launch: true \}/);
assert.match(world, /difficulty = clamp\(Math\.max\(0, state\.generatedFloor - 40\) \/ 190/);
assert.match(world, /minLength = side === 'center' \? lerp\(500, 310, geometry\) : lerp\(330, 205, geometry\)/);
assert.match(world, /step\.ring/);
assert.match(world, /step\.launch/);
assert.match(world, /ring\.radius = lerp\(TUNE\.ring\.baseRadius, TUNE\.ring\.minRadius, difficulty\)/);
assert.match(world, /phaseForFloor/);
assert.match(world, /routeStat\(type\)\.generated \+= 1/);
assert.match(world, /barkSweetness/);

assert.match(gameplay, /function doAirJump\(/);
assert.match(gameplay, /player\.airJumps -= 1/);
assert.match(gameplay, /function refreshAirJump\(/);
assert.match(gameplay, /function addComboLink\(/);
assert.match(gameplay, /bitCount\(player\.comboKindsMask\) >= TUNE\.combo\.hyperVariety/);
assert.match(gameplay, /const surge = player\.combo >= TUNE\.combo\.sapSurgeThreshold/);
assert.match(gameplay, /TUNE\.sap\.surgeMultiplier/);
assert.match(gameplay, /function threadRings\(/);
assert.match(gameplay, /refreshAirJump\('RING'/);
assert.match(gameplay, /refreshAirJump\('BARK'/);
assert.match(gameplay, /refreshAirJump\('SAP'/);
assert.match(gameplay, /groundedBranch\?\.chunkType === 'RECOVERY'/);
assert.match(gameplay, /baseline \+ rubber \* TUNE\.threat\.rubberGain/);
assert.match(gameplay, /boundedPush\(telemetry\.samples\.reboundRetention/);
assert.match(gameplay, /boundedPush\(telemetry\.samples\.sapReleaseGain/);
assert.match(gameplay, /telemetry\.counters\.sapCatches \+= 1/);
assert.match(gameplay, /if \(!player\.grounded\) player\.vy \+= \(state\.GRAVITY \+ sapForce\.ay\) \* dt/);

assert.match(jumpContract, /duplicateEdgeMs = 28/);
assert.match(jumpContract, /Start-key quarantine now handles the old title-screen leak/);
assert.match(jumpContract, /player\.jumpRequestId > player\.consumedJumpRequestId/);
assert.match(jumpContract, /player\.jumpRequestId === player\.consumedJumpRequestId/);
assert.match(jumpContract, /telemetry\.counters\.jumps > beforeGroundJumps/);
assert.match(jumpContract, /telemetry\.counters\.doubleJumps > beforeAirJumps/);
assert.match(jumpContract, /player\.consumedJumpRequestId = activeRequestId/);
assert.match(jumpContract, /action: airJumped \? 'AIR_KICK' : 'GROUND_JUMP'/);
assert.match(jumpContract, /S\.requestJump = requestJump/);
assert.match(jumpContract, /S\.update = update/);

assert.match(flowAssist, /function attachSap\(/);
assert.match(flowAssist, /announce\('SAP SNAP ↑'/);
assert.match(flowAssist, /function releaseSap\(/);
assert.match(flowAssist, /QUICK SLING ↑ · AIR KICK READY/);
assert.match(flowAssist, /function barkKick\(/);
assert.match(flowAssist, /BARK KICK ↑ · AIR KICK READY/);
assert.match(flowAssist, /function updateMomentumBurst\(/);
assert.match(flowAssist, /function rememberStride\(/);
assert.match(flowAssist, /function preUpdateStride\(/);
assert.match(flowAssist, /stride-launch-carry/);
assert.match(flowAssist, /function applyComboCarry\(/);
assert.match(flowAssist, /combo-speed-carry/);
assert.match(flowAssist, /function maybeEnterCrownvelocity\(/);
assert.match(flowAssist, /TUNE\.combo\.easyHyperThreshold/);
assert.match(flowAssist, /route: variedFlowReady && !pureFlowReady \? 'VARIED' : 'ICY_FLOW'/);
assert.match(flowAssist, /function primeAllRouteGrammars\(/);
assert.match(flowAssist, /S\.generateUntil\(5840\)/);
assert.match(flowAssist, /S\.flowAssist/);

assert.doesNotMatch(render, /routeRng\.next\(/, 'rendering must never consume route RNG');
assert.match(render, /function drawRing\(/);
assert.match(render, /function drawLaunchBurl\(/);
assert.match(render, /AIR KICK/);
assert.match(render, /SAP SURGE ARMED/);
assert.match(render, /CROWNVELOCITY/);
assert.match(render, /drawTelemetry/);
assert.match(render, /SYLVARIA: SEQUOIA/);
assert.match(render, /sceneScale = state\.reducedMotion \? 1 : 1 - speedWide - hyperWide/);

assert.match(input, /window\.SYLVARIA_SEQUOIA_DEBUG/);
assert.match(input, /version: '0\.3\.0'/);
assert.match(input, /fixedHz: 120/);
assert.match(input, /function quarantineStartKey\(/);
assert.match(input, /if \(JUMP_KEYS\.has\(code\)\) state\.keys\.add\(code\)/);
assert.match(input, /const wasDown = state\.keys\.has\(event\.code\)/);
assert.match(input, /JUMP_KEYS\.has\(event\.code\) && !wasDown/);
assert.match(input, /airJumps: player\.airJumps/);
assert.match(input, /jumpInput: S\.jumpInputContract\?\.getState\(\) \|\| null/);
assert.match(input, /flowAssist: S\.flowAssist\?\.getState\(\) \|\| null/);
assert.match(input, /getPhases:/);
assert.match(input, /getTelemetry: S\.summarizeTelemetry/);
assert.match(input, /setTuning: S\.setTuning/);
assert.match(input, /retry: \(\) => S\.startRun\(state\.runSeed\)/);
assert.match(input, /nextRoute: \(\) => S\.startRun\(state\.runSeed \+ 1\)/);

assert.doesNotMatch(runtime, /\benemy\b|\bdamage\b|\battack\b/i, 'Sylvaria: Sequoia runtime should remain traversal-first');
assert.match(design, /renewable Air Kick/i);
assert.match(design, /Launch Burl/i);
assert.match(design, /Resin Ring/i);
assert.match(design, /SAP SURGE/);
assert.match(design, /CROWNLINE/);
assert.match(design, /same-seed comparisons/i);
assert.match(design, /Momentum Burn frequency/i);

assert.ok(!existsSync(join(root, 'public/game-runtimes/crownrush')), 'obsolete Crownrush runtime must be removed');
assert.ok(!existsSync(join(root, 'scripts/validate-crownrush.mjs')), 'obsolete Crownrush validator must be removed');

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  title: 'Sylvaria: Sequoia',
  version: '0.3.0-icy-flow-pass',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'],
  phases: ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE'],
  accessibility: ['runway Rootways', 'speed-scaled jump', 'stride memory', 'combo carry', 'slow early pressure'],
  traversalAssists: ['Momentum Burst', 'Air Kick', 'Sap Snap', 'Quick Sling', 'Bark Kick'],
  aerialLoop: ['2+ floor skip', 'combo carry', 'wall recovery', 'Sap refresh', 'CROWNVELOCITY'],
  jumpInput: ['start-key quarantine', '28ms duplicate guard', 'unique request id', 'single action consumption'],
  telemetry: ['airtime', 'double jump', 'refreshes', 'speed', 'rebound', 'rings', 'burls', 'sapline', 'combo', 'threat', 'route completion'],
}, null, 2));
