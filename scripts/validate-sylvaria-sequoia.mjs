import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const modules = ['00-core.js', '01-world.js', '02-gameplay.js', '03-render.js', '04-input.js'];
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
const world = readFileSync(join(runtimeRoot, '01-world.js'), 'utf8');
const gameplay = readFileSync(join(runtimeRoot, '02-gameplay.js'), 'utf8');
const render = readFileSync(join(runtimeRoot, '03-render.js'), 'utf8');
const input = readFileSync(join(runtimeRoot, '04-input.js'), 'utf8');
const runtime = [core, world, gameplay, render, input].join('\n');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<title>Sylvaria: Sequoia v0\.3\.0<\/title>/);
assert.match(index, /<canvas id="c" width="960" height="640"/);
assert.match(index, /00-core\.js[\s\S]*01-world\.js[\s\S]*02-gameplay\.js[\s\S]*03-render\.js[\s\S]*04-input\.js/);
assert.match(index, /air kick/i);
assert.doesNotMatch(index, /crownrush|\.\/game\.js/i);

assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(core, /routeRng: makeRng/);
assert.match(core, /fxRng: makeRng/);
assert.match(core, /airJumps: 1/);
assert.match(core, /sapSurgeThreshold: 5/);
assert.match(core, /hyperThreshold: 7/);
assert.match(core, /hyperVariety: 3/);
assert.match(core, /ascentDecayScale: 0\.42/);
assert.match(core, /saplineDecayScale: 0\.36/);
assert.match(core, /doubleJumps/);
assert.match(core, /airJumpRefreshes/);
assert.match(core, /ringsThreaded/);
assert.match(core, /sapSurges/);
assert.match(core, /comboLinkIntervals/);
assert.match(core, /routeStats/);

for (const grammar of ['FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT']) {
  assert.match(world, new RegExp(`${grammar}: \\[`), `missing ${grammar} route grammar`);
}
for (const phase of ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE']) {
  assert.match(world, new RegExp(phase), `missing ${phase} difficulty phase`);
}
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
assert.match(input, /airJumps: player\.airJumps/);
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
  version: '0.3.0',
  fixedHz: 120,
  modules,
  grammars: ['FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'],
  phases: ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE'],
  aerialLoop: ['Air Kick', 'Bark refresh', 'Resin Ring refresh', 'Sap refresh', 'SAP SURGE', 'CROWNVELOCITY'],
  telemetry: ['airtime', 'double jump', 'refreshes', 'speed', 'rebound', 'rings', 'burls', 'sapline', 'combo', 'threat', 'route completion'],
}, null, 2));
