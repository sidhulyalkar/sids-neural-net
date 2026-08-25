import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const files = [
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
  '02-living-canopy.js',
  '03-render-canopy.js',
  '03-render-fast-underpaint.js',
  '03-render-reference-pass.js',
  '03-render-reference-handoff.js',
  '03-render-altitude-realism.js',
  '03-render-performance.js',
  '03-minimal-hud-gate.js',
  '03-sap-stick-control-hud.js',
  '03-heartwood-trials-render.js',
  '03-living-canopy-render.js',
  '03-canopy-progress-hud.js',
  '03-living-objective-hud.js',
  '03-title-focus-guard.js',
  '04-input.js',
];

for (const name of ['index.html', ...files]) {
  const path = join(runtimeRoot, name);
  assert.ok(existsSync(path), `missing v0.5 artifact: ${name}`);
  if (name.endsWith('.js')) execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
}

const read = (name) => readFileSync(join(runtimeRoot, name), 'utf8');
const index = read('index.html');
const core = read('00-core.js');
const feel = read('00-feel-tuning.js');
const world = read('01-world.js');
const heartwood = read('02-heartwood-quest.js');
const trials = read('02-canopy-trials.js');
const living = read('02-living-canopy.js');
const livingRender = read('03-living-canopy-render.js');
const objectiveHud = read('03-living-objective-hud.js');
const input = read('04-input.js');

assert.match(index, /Sylvaria: Sequoia v0\.5\.0/);
assert.match(index, /02-canopy-trials\.js[\s\S]*02-living-canopy\.js/);
assert.match(index, /03-heartwood-trials-render\.js[\s\S]*03-living-canopy-render\.js[\s\S]*03-canopy-progress-hud\.js[\s\S]*03-living-objective-hud\.js/);
assert.match(index, /discover 6 Wonders/i);
assert.match(index, /Skyheart 360/i);

// Preserve the movement envelope that made v0.4 playable.
for (const pattern of [
  /groundAccel: 3720/,
  /airAccel: 1900/,
  /maxSpeed: 690/,
  /reverseAirScale: 1\.08/,
  /strideLaunchCarry: 0\.82/,
  /base: 642/,
  /momentumGain: 0\.62/,
  /stickAcquireBufferSeconds: 0\.18/,
  /stickSteerAccel: 2450/,
  /stickReleaseMinVy: 630/,
  /baseSpeed: 20/,
]) assert.match(feel, pattern);
assert.match(core, /FIXED_DT: 1 \/ 120/);
assert.match(world, /state\.LEFT_WALL = 100/);
assert.match(world, /state\.RIGHT_WALL = 860/);
assert.match(heartwood, /FINAL_CROWN_FLOOR = 250/);
assert.match(heartwood, /sylvaria\.sequoia\.heartseedMask/);
assert.match(trials, /BREAKAWAY/);
assert.match(trials, /PENDULUM/);
assert.match(trials, /CONEFALL/);
assert.match(trials, /THUNDERCROWN/);

for (const grammar of ['CHOIRLINE', 'HOLLOWRUN', 'MIGRATION', 'AURORARUN', 'ELDERSPAN', 'ECHOFLIGHT', 'SKYHEART']) {
  assert.match(living, new RegExp(`${grammar}: \\[`), `missing Living Canopy grammar ${grammar}`);
}
for (const phase of [
  /name: 'LIVING CROWN'[\s\S]*floor: 250/,
  /name: 'ELDER SKY'[\s\S]*floor: 320/,
]) assert.match(living, phase);

for (const wonder of [
  /WIND CHOIR[\s\S]*floor: 88[\s\S]*condition: 'flow'/,
  /LIGHTNING HOLLOW[\s\S]*floor: 132[\s\S]*condition: 'bark'/,
  /SUNWING MIGRATION[\s\S]*floor: 174[\s\S]*condition: 'flight'/,
  /RESIN AURORA[\s\S]*floor: 216[\s\S]*condition: 'clean-sap'/,
  /ELDER BOUGH[\s\S]*floor: 278[\s\S]*condition: 'stride'/,
  /CROWN ECHO[\s\S]*floor: 326[\s\S]*condition: 'hyper'/,
]) assert.match(living, wonder);

for (const pattern of [
  /living-canopy-v1/,
  /SKYHEART_FLOOR = 360/,
  /ALL_WONDERS_MASK = 0b111111/,
  /sylvaria\.sequoia\.wonderMask/,
  /sylvaria\.sequoia\.skyheartRung/,
  /recentCleanSap\(/,
  /player\.clingActive/,
  /player\.combo >= 3/,
  /Math\.abs\(player\.vx\) >= 450/,
  /player\.strideMomentum \|\| 0\) >= 600 && player\.combo >= 5/,
  /Boolean\(player\.hyper\)/,
  /canopy-wonder-discovered/,
  /skyheart-unlocked/,
  /skyheart-rung/,
  /elder-wind-pulse/,
  /ring\._livingPulse/,
  /branch\._trialFragile = true/,
  /knot\._trialSway = true/,
  /objectiveLadder|function objective\(/,
]) assert.match(living + objectiveHud, pattern);

assert.doesNotMatch(living, /state\.routeRng\.next\(/, 'Living Canopy must not consume route RNG');
assert.doesNotMatch(livingRender, /routeRng\.next\(/, 'Living Canopy renderer must not consume route RNG');
assert.match(livingRender, /living-canopy-render-v1/);
assert.match(livingRender, /drawWindChoir/);
assert.match(livingRender, /drawLightningHollow/);
assert.match(livingRender, /drawSunwing/);
assert.match(livingRender, /drawResinAurora/);
assert.match(livingRender, /drawElderBough/);
assert.match(livingRender, /drawCrownEcho/);
assert.match(livingRender, /drawSkyheart/);
assert.match(livingRender, /drawPulse/);
assert.match(objectiveHud, /living-objective-hud-v1/);
assert.match(objectiveHud, /scoreIsSecondary: true/);
assert.match(objectiveHud, /Canopy Wonders/);
assert.match(objectiveHud, /Skyheart/);
assert.doesNotMatch(objectiveHud, /player\.score/);

// Existing one-button movement language and safe reset remain unchanged.
assert.match(input, /const SHIFT_KEYS/);
assert.match(input, /const RESET_KEYS = new Set\(\['Digit0', 'Numpad0'\]\)/);
assert.doesNotMatch(input, /event\.code === 'KeyR'/);

const combined = files.map(read).join('\n');
assert.doesNotMatch(combined, /\benemy\b|\bdamage\b|\battack\b/i, 'Sequoia should remain traversal-first');

console.log(JSON.stringify({
  ok: true,
  runtime: 'sylvaria-sequoia',
  version: '0.5.0-living-canopy',
  motivation: ['5 persistent Heartseeds', 'Living Crown @ 250', '6 persistent Canopy Wonders', 'Skyheart @ 360', 'endless PB tail'],
  setpieces: ['CHOIRLINE', 'HOLLOWRUN', 'MIGRATION', 'AURORARUN', 'ELDERSPAN', 'ECHOFLIGHT', 'SKYHEART'],
  wonderSkills: ['3x Flow', 'Bark Cling', '450 flight speed', 'Clean Sap', '600 Stride + 5x Flow', 'CROWNVELOCITY'],
  lateSystems: ['fragile footing', 'moving Sap anchors', 'pulsing rings', 'telegraphed elder-wind pulses', 'Conefall', 'crosswind'],
}, null, 2));
