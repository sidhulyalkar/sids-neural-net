import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const feel = readFileSync(join(runtimeRoot, '00-feel-tuning.js'), 'utf8');
const core = readFileSync(join(runtimeRoot, '00-core.js'), 'utf8');
const world = readFileSync(join(runtimeRoot, '01-world.js'), 'utf8');
const assist = readFileSync(join(runtimeRoot, '02-flow-assist.js'), 'utf8');

function section(source, name) {
  const marker = `Object.assign(TUNE.${name}, {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing TUNE.${name} tuning section`);
  const bodyStart = start + marker.length;
  const end = source.indexOf('\n  });', bodyStart);
  assert.notEqual(end, -1, `unterminated TUNE.${name} tuning section`);
  return source.slice(bodyStart, end);
}

function numberIn(source, key) {
  const match = source.match(new RegExp(`\\b${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  assert.ok(match, `missing numeric ${key}`);
  return Number(match[1]);
}

function assignmentNumber(source, expression) {
  const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
  assert.ok(match, `missing assignment ${expression}`);
  return Number(match[1]);
}

function grammarBody(name) {
  const marker = `${name}: [`;
  const start = world.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name} route grammar`);
  const bodyStart = start + marker.length;
  let depth = 1;
  let cursor = bodyStart;
  for (; cursor < world.length; cursor += 1) {
    const char = world[cursor];
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.equal(depth, 0, `unterminated ${name} route grammar`);
  return world.slice(bodyStart, cursor);
}

const gaps = (name) => [...grammarBody(name).matchAll(/\bdy:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
const sum = (values, count) => values.slice(0, count).reduce((total, value) => total + value, 0);

const run = section(feel, 'run');
const jump = section(feel, 'jump');
const rebound = section(feel, 'rebound');
const sap = section(feel, 'sap');
const combo = section(feel, 'combo');
const threat = section(feel, 'threat');
const gravity = Math.abs(numberIn(core, 'GRAVITY'));
const apex = (vy) => (vy * vy) / (2 * gravity);

const jumpBase = numberIn(jump, 'base');
const momentumGain = numberIn(jump, 'momentumGain');
const momentumCap = numberIn(jump, 'momentumCap');
const comboLift = numberIn(jump, 'comboLift');
const maxSpeed = numberIn(run, 'maxSpeed');
const strideMax = numberIn(run, 'strideMax');
const burstMinSpeed = numberIn(run, 'burstMinSpeed');
const jumpVy = (speed, flow = 0) => jumpBase + Math.min(momentumCap, speed * momentumGain) + Math.min(62, flow * comboLift);

const flow = gaps('FLOW');
const recovery = gaps('RECOVERY');
const grove = gaps('GROVE');
const maxTeachingGap = Math.max(...flow.slice(0, 3), ...recovery);
const twoFloorTarget = Math.min(sum(flow, 2), sum(recovery, 2));
const threeFloorTarget = sum(flow, 3);

const samples = [
  { label: 'standing', speed: 0, flow: 0 },
  { label: 'burst-entry', speed: burstMinSpeed, flow: 0 },
  { label: 'developed-run', speed: 480, flow: 1 },
  { label: 'full-stride', speed: strideMax, flow: 4 },
].map((sample) => {
  const vy = jumpVy(sample.speed, sample.flow);
  return { ...sample, vy, apex: apex(vy) };
});
const by = Object.fromEntries(samples.map((sample) => [sample.label, sample]));

// Easy to enter, but not self-driving.
assert.ok(by.standing.apex >= maxTeachingGap * 1.15, `standing jump lost one-floor safety margin: ${by.standing.apex.toFixed(1)} vs ${maxTeachingGap}`);
assert.ok(by['burst-entry'].apex >= twoFloorTarget * 1.12, `burst-entry should support a deliberate 2-floor clear: ${by['burst-entry'].apex.toFixed(1)} vs ${twoFloorTarget}`);
assert.ok(by['developed-run'].apex >= threeFloorTarget, `developed run should just reach a 3-floor FLOW clear: ${by['developed-run'].apex.toFixed(1)} vs ${threeFloorTarget}`);
assert.ok(by['full-stride'].apex < sum(flow, 4), 'ground movement alone should not automatically clear four FLOW floors');

// Passive bark is a redirect. Deliberate Bark Kick is the wall reward.
const passiveWallVy = numberIn(rebound, 'verticalBase') + Math.min(numberIn(rebound, 'verticalCap'), maxSpeed * numberIn(rebound, 'verticalGain'));
const barkKickVy = numberIn(rebound, 'kickVertical');
assert.ok(apex(passiveWallVy) < Math.min(...recovery) * 0.55, `passive bark redirect climbs too much: ${apex(passiveWallVy).toFixed(1)}px`);
assert.ok(apex(barkKickVy) >= twoFloorTarget, 'deliberate Bark Kick must be capable of about two teaching floors');
assert.ok(numberIn(rebound, 'comboSpeed') > 10000, 'passive bark contact must never award Flow');
assert.ok(numberIn(jump, 'wallRefreshSpeed') > 10000, 'passive bark contact must never refresh Air Kick');
assert.match(assist, /function beginCling\(/);
assert.match(assist, /BARK CLING · JUMP TO KICK/);
assert.match(assist, /passiveBarkRedirects/);

// Recovery tools are useful, not automatic multi-floor solvers.
assert.ok(apex(numberIn(jump, 'doubleBase')) >= Math.min(...recovery) * 0.9, 'Air Kick base lift lost single-floor utility');
assert.ok(apex(numberIn(sap, 'quickMinVy')) >= Math.min(...recovery) * 1.5, 'Quick Sling needs obvious upward value');
assert.ok(apex(numberIn(sap, 'quickMinVy')) < threeFloorTarget, 'Quick Sling should not independently solve a three-floor route');

// Anti-runaway envelope based on the 371x recording failure.
assert.ok(numberIn(run, 'strideLaunchCarry') <= 0.65, 'Stride turnaround carry is too automatic');
assert.ok(numberIn(run, 'comboCarryBase') <= 12, 'combo carry is compounding too aggressively');
assert.ok(numberIn(run, 'comboCarryCap') <= 30, 'combo carry cap is too high');
assert.ok(numberIn(run, 'comboAccelCap') <= 0.12, 'Flow acceleration cap is too high');
assert.ok(numberIn(combo, 'window') <= 3.0, 'Flow timeout is too forgiving');
assert.ok(numberIn(combo, 'landingGrace') <= 1.0, 'touchdown grace is too forgiving');
assert.ok(numberIn(combo, 'easyHyperThreshold') >= 9, 'pure-flow CROWNVELOCITY is igniting too early');
assert.ok(numberIn(threat, 'baseSpeed') >= 22, 'Rootways pressure has become negligible');
assert.match(assist, /function skillSpeedCap\(/);
assert.match(assist, /player\.vx = clamp\(player\.vx, -skillSpeedCap\(\), skillSpeedCap\(\)\)/);

// Grove Chambers must be real topology rather than painted scenery.
const leftWall = assignmentNumber(world, 'state.LEFT_WALL');
const rightWall = assignmentNumber(world, 'state.RIGHT_WALL');
assert.equal(leftWall, 118);
assert.equal(rightWall, 842);
assert.equal(rightWall - leftWall, 724);
assert.ok(grove.some((gap) => gap >= 100), 'GROVE needs a genuinely open vertical beat');
assert.match(world, /GROVE:/);
const phaseFloors = [...world.matchAll(/\{ name: '[^']+', floor: (\d+)/g)].map((match) => Number(match[1]));
assert.deepEqual(phaseFloors, [0, 30, 70, 115, 165], 'difficulty phase boundaries drifted');

console.log(JSON.stringify({
  ok: true,
  mode: 'skill-flow-not-autopilot',
  corridor: { left: leftWall, right: rightWall, width: rightWall - leftWall },
  rootways: { flow, recovery, grove, maxTeachingGap, twoFloorTarget, threeFloorTarget },
  jumpEnvelope: samples.map(({ label, speed, flow: flowCount, vy, apex: height }) => ({ label, speed, flow: flowCount, launchVy: Number(vy.toFixed(1)), ballisticApex: Number(height.toFixed(1)) })),
  wallEnvelope: { passiveApex: Number(apex(passiveWallVy).toFixed(1)), barkKickApex: Number(apex(barkKickVy).toFixed(1)) },
  phaseFloors,
}, null, 2));
