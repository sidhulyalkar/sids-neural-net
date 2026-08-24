import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const feel = readFileSync(join(runtimeRoot, '00-feel-tuning.js'), 'utf8');
const core = readFileSync(join(runtimeRoot, '00-core.js'), 'utf8');
const world = readFileSync(join(runtimeRoot, '01-world.js'), 'utf8');

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

function grammarGaps(name) {
  const gaps = [...grammarBody(name).matchAll(/\bdy:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  assert.ok(gaps.length > 0, `${name} must contain vertical gaps`);
  return gaps;
}

function prefixSum(values, count) {
  return values.slice(0, count).reduce((sum, value) => sum + value, 0);
}

const run = section(feel, 'run');
const jump = section(feel, 'jump');
const rebound = section(feel, 'rebound');
const sap = section(feel, 'sap');
const combo = section(feel, 'combo');
const threat = section(feel, 'threat');
const gravity = Math.abs(numberIn(core, 'GRAVITY'));

const jumpBase = numberIn(jump, 'base');
const momentumGain = numberIn(jump, 'momentumGain');
const momentumCap = numberIn(jump, 'momentumCap');
const comboLift = numberIn(jump, 'comboLift');
const strideMax = numberIn(run, 'strideMax');
const burstMinSpeed = numberIn(run, 'burstMinSpeed');
const airKickBase = numberIn(jump, 'doubleBase');
const barkKickVertical = numberIn(rebound, 'kickVertical');
const quickSlingVertical = numberIn(sap, 'quickMinVy');
const snapMinVy = numberIn(sap, 'snapMinVy');
const snapLiftBonus = numberIn(sap, 'snapLiftBonus');

const apex = (vy) => (vy * vy) / (2 * gravity);
const jumpVy = (speed, flow = 0) =>
  jumpBase + Math.min(momentumCap, speed * momentumGain) + Math.min(62, flow * comboLift);

const flow = grammarGaps('FLOW');
const recovery = grammarGaps('RECOVERY');
const earlyGaps = [...flow, ...recovery];
const maxEarlyGap = Math.max(...earlyGaps);
const easyTwoFloor = Math.min(prefixSum(flow, 2), prefixSum(recovery, 2));
const flowThreeFloor = prefixSum(flow, 3);
const flowFourFloor = prefixSum(flow, 4);
const flowFiveFloor = prefixSum(flow, 5);

const samples = [
  { label: 'standing', speed: 0, flow: 0 },
  { label: 'burst-entry', speed: burstMinSpeed, flow: 0 },
  { label: 'running', speed: 350, flow: 0 },
  { label: 'rush', speed: 560, flow: 2 },
  { label: 'full-stride', speed: strideMax, flow: 4 },
].map((sample) => {
  const vy = jumpVy(sample.speed, sample.flow);
  return { ...sample, vy, apex: apex(vy) };
});

const byLabel = Object.fromEntries(samples.map((sample) => [sample.label, sample]));

// Rootways must be forgiving before any advanced mechanic is involved.
assert.ok(
  byLabel.standing.apex >= maxEarlyGap * 1.55,
  `standing jump lost Rootways safety margin: apex=${byLabel.standing.apex.toFixed(1)} maxGap=${maxEarlyGap}`
);
assert.ok(
  byLabel['burst-entry'].apex >= easyTwoFloor * 1.18,
  `burst-entry speed must make a 2-floor combo comfortably possible: apex=${byLabel['burst-entry'].apex.toFixed(1)} need=${easyTwoFloor}`
);
assert.ok(
  byLabel.running.apex >= flowThreeFloor * 1.10,
  `ordinary developed run must reach a 3-floor Flow clear: apex=${byLabel.running.apex.toFixed(1)} need=${flowThreeFloor}`
);
assert.ok(
  byLabel.rush.apex >= flowFourFloor * 1.08,
  `Rush state must reach a 4-floor Flow clear: apex=${byLabel.rush.apex.toFixed(1)} need=${flowFourFloor}`
);
assert.ok(
  byLabel['full-stride'].apex >= flowFiveFloor * 1.05,
  `full Stride must reach a 5-floor Flow clear: apex=${byLabel['full-stride'].apex.toFixed(1)} need=${flowFiveFloor}`
);

// Recovery tools must themselves buy meaningful vertical space.
assert.ok(apex(airKickBase) >= maxEarlyGap * 1.05, 'Air Kick base lift must clear an early single-floor gap');
assert.ok(apex(barkKickVertical) >= easyTwoFloor * 1.05, 'Bark Kick must clear roughly two Rootways floors');
assert.ok(apex(quickSlingVertical) >= easyTwoFloor, 'Quick Sling must clear roughly two Rootways floors');
assert.ok(
  apex(snapMinVy + snapLiftBonus * 0.5) >= maxEarlyGap * 1.18,
  'a moderate above-knot Sap Snap must have obvious upward utility'
);

// Control generosity and positive feedback are design invariants, not incidental tuning.
assert.ok(numberIn(run, 'groundFriction60Hz') >= 0.90, 'ground momentum retention regressed');
assert.ok(numberIn(run, 'airDrag120Hz') >= 0.9988, 'air momentum retention regressed');
assert.ok(numberIn(run, 'strideLaunchCarry') >= 0.88, 'Stride turnaround carry regressed');
assert.ok(numberIn(run, 'comboCarryBase') >= 30, 'multi-floor clears must add bounded speed carry');
assert.ok(numberIn(combo, 'window') >= 3.5, 'Flow timeout became too strict');
assert.ok(numberIn(combo, 'landingGrace') >= 1.5, 'touchdown grace became too strict');
assert.ok(numberIn(combo, 'easyHyperThreshold') <= 6, 'pure Icy-style chain must reach CROWNVELOCITY by 6x');
assert.ok(numberIn(threat, 'baseSpeed') <= 20, 'Rootways pressure became too punitive');

const phaseFloors = [...world.matchAll(/\{ name: '[^']+', floor: (\d+)/g)].map((match) => Number(match[1]));
assert.deepEqual(phaseFloors, [0, 44, 90, 145, 205], 'difficulty phase boundaries drifted');

console.log(JSON.stringify({
  ok: true,
  gravity,
  rootways: {
    flowGaps: flow,
    recoveryGaps: recovery,
    maxSingleGap: maxEarlyGap,
    twoFloorTarget: easyTwoFloor,
    threeFloorTarget: flowThreeFloor,
    fourFloorTarget: flowFourFloor,
    fiveFloorTarget: flowFiveFloor,
  },
  jumpEnvelope: samples.map(({ label, speed, flow: flowCount, vy, apex: height }) => ({
    label,
    speed,
    flow: flowCount,
    launchVy: Number(vy.toFixed(1)),
    ballisticApex: Number(height.toFixed(1)),
  })),
  recoveryEnvelope: {
    airKickApex: Number(apex(airKickBase).toFixed(1)),
    barkKickApex: Number(apex(barkKickVertical).toFixed(1)),
    quickSlingApex: Number(apex(quickSlingVertical).toFixed(1)),
    moderateSapSnapApex: Number(apex(snapMinVy + snapLiftBonus * 0.5).toFixed(1)),
  },
  phaseFloors,
}, null, 2));
