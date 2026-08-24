import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const feel = readFileSync(join(runtimeRoot, '00-feel-tuning.js'), 'utf8');
const core = readFileSync(join(runtimeRoot, '00-core.js'), 'utf8');
const world = readFileSync(join(runtimeRoot, '01-world.js'), 'utf8');
const assist = readFileSync(join(runtimeRoot, '02-flow-assist.js'), 'utf8');
const stick = readFileSync(join(runtimeRoot, '02-sap-stick.js'), 'utf8');

function section(source, name) {
  const marker = `Object.assign(TUNE.${name}, {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing TUNE.${name}`);
  const bodyStart = start + marker.length;
  const end = source.indexOf('\n  });', bodyStart);
  assert.notEqual(end, -1, `unterminated TUNE.${name}`);
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
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = start + marker.length;
  let depth = 1;
  let cursor = bodyStart;
  for (; cursor < world.length; cursor += 1) {
    if (world[cursor] === '[') depth += 1;
    else if (world[cursor] === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.equal(depth, 0, `unterminated ${name}`);
  return world.slice(bodyStart, cursor);
}
function steps(name) {
  const body = grammarBody(name);
  return [...body.matchAll(/\{([^{}]+)\}/g)].map((match) => {
    const source = match[1];
    const dy = Number(source.match(/\bdy:\s*(\d+(?:\.\d+)?)/)?.[1] ?? NaN);
    return {
      dy,
      branch: !/branch:\s*false/.test(source),
      anchor: /anchor:\s*'[^']+'/.test(source),
      length: Number(source.match(/\blength:\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0),
    };
  });
}
const sum = (values) => values.reduce((total, value) => total + value, 0);
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

const flow = steps('FLOW');
const recovery = steps('RECOVERY');
const grove = steps('GROVE');
const saprun = steps('SAPRUN');
const slingshot = steps('SLINGSHOT');
const standingTeachingGap = Math.max(flow[0].dy, ...recovery.filter((step) => step.branch).map((step) => step.dy));
const laterFlowGap = Math.max(...flow.slice(1).filter((step) => step.branch).map((step) => step.dy));
const twoFloorTarget = sum(flow.slice(0, 2).map((step) => step.dy));
const threeFloorTarget = sum(flow.slice(0, 3).map((step) => step.dy));
const samples = [
  { label: 'standing', speed: 0, flow: 0 },
  { label: 'burst-entry', speed: burstMinSpeed, flow: 0 },
  { label: 'developed-run', speed: 480, flow: 1 },
  { label: 'full-stride', speed: strideMax, flow: 4 },
].map((sample) => ({ ...sample, vy: jumpVy(sample.speed, sample.flow), apex: apex(jumpVy(sample.speed, sample.flow)) }));
const by = Object.fromEntries(samples.map((sample) => [sample.label, sample]));

// A stationary player gets a real safety margin only on the introductory and
// recovery tiers. Later FLOW shelves intentionally require earned momentum.
assert.ok(by.standing.apex >= standingTeachingGap * 1.10, `standing jump lost teaching margin: ${by.standing.apex.toFixed(1)} vs ${standingTeachingGap}`);
assert.ok(by.standing.apex < laterFlowGap * 1.08, 'standing jump is beginning to erase the momentum requirement from later FLOW transfers');
assert.ok(by['burst-entry'].apex >= twoFloorTarget * 0.96, `burst entry lost two-floor utility: ${by['burst-entry'].apex.toFixed(1)} vs ${twoFloorTarget}`);
assert.ok(by['developed-run'].apex >= threeFloorTarget * 0.92, `developed run lost FLOW utility: ${by['developed-run'].apex.toFixed(1)} vs ${threeFloorTarget}`);
assert.ok(by['full-stride'].apex < threeFloorTarget + 145, 'ground movement is becoming a route solver again');

const passiveWallVy = numberIn(rebound, 'verticalBase') + Math.min(numberIn(rebound, 'verticalCap'), maxSpeed * numberIn(rebound, 'verticalGain'));
assert.ok(apex(passiveWallVy) < Math.min(...recovery.map((step) => step.dy)) * 0.55, 'passive bark redirect climbs too much');
assert.ok(numberIn(rebound, 'comboSpeed') > 10000, 'passive bark must never score');
assert.ok(numberIn(jump, 'wallRefreshSpeed') > 10000, 'passive bark must never refresh Air Kick');
assert.ok(apex(numberIn(rebound, 'kickVertical')) >= twoFloorTarget * 0.85, 'Bark Kick lost meaningful rescue height');

assert.ok(numberIn(run, 'strideLaunchCarry') <= 0.65, 'Stride carry is too automatic');
assert.ok(numberIn(run, 'comboCarryCap') <= 30, 'combo carry cap is too high');
assert.ok(numberIn(run, 'comboAccelCap') <= 0.12, 'Flow acceleration cap is too high');
assert.ok(numberIn(combo, 'window') <= 3.0, 'Flow timeout is too forgiving');
assert.ok(numberIn(combo, 'easyHyperThreshold') >= 9, 'pure-flow crown ignites too early');
assert.ok(numberIn(threat, 'baseSpeed') >= 22, 'Rootways pressure vanished');
assert.match(assist, /passiveBarkRedirects/);

const branchRatio = (route) => route.filter((step) => step.branch).length / route.length;
assert.equal(grove.filter((step) => step.branch).length, 2, 'GROVE should have exactly two real branch tiers');
assert.equal(saprun.filter((step) => step.branch).length, 2, 'SAPRUN should have exactly two real branch tiers');
assert.equal(slingshot.filter((step) => step.branch).length, 2, 'SLINGSHOT should have exactly two real branch tiers');
assert.ok(branchRatio(saprun) <= 0.4, 'SAPRUN became branch-crowded');
assert.ok(saprun.filter((step) => step.anchor).length >= 3, 'SAPRUN needs three branchless amber anchors');
assert.ok(grove.filter((step) => step.anchor).length >= 2, 'GROVE needs branchless amber traversal');
assert.ok(slingshot.filter((step) => step.anchor).length >= 2, 'SLINGSHOT needs branchless amber traversal');

const leftWall = assignmentNumber(world, 'state.LEFT_WALL');
const rightWall = assignmentNumber(world, 'state.RIGHT_WALL');
assert.equal(leftWall, 100);
assert.equal(rightWall, 860);
assert.equal(rightWall - leftWall, 760);

const stickRange = numberIn(sap, 'stickRange');
const stickHold = numberIn(sap, 'stickHoldSeconds');
const stickReuse = numberIn(sap, 'stickReuseLockSeconds');
const stickReleaseVy = numberIn(sap, 'stickReleaseMinVy');
assert.ok(stickRange >= 600 && stickRange <= 680, 'Sap Stick target range drifted');
assert.ok(stickHold >= 0.18 && stickHold <= 0.25, 'Sap Stick tether should stay a quick rhythmic beat');
assert.ok(stickReuse >= 0.6, 'Sap Stick anchors can be farmed too quickly');
assert.ok(apex(stickReleaseVy) >= 90, 'Sap Stick vault lost meaningful vertical rescue');
assert.ok(numberIn(sap, 'stickAnchorPriority') >= 90, 'authored branchless anchors are not preferred strongly enough');
assert.match(stick, /function findTarget\(/);
assert.match(stick, /function castSapStick\(/);
assert.match(stick, /sap-stick-cast/);
assert.doesNotMatch(stick, /charge(?:Seconds|Time)|holdToCharge/i);

const branchlessDys = [...grove, ...saprun, ...slingshot].filter((step) => !step.branch).map((step) => step.dy);
assert.ok(Math.max(...branchlessDys) <= 180, 'branchless anchor spacing exceeds authored Sap Stick rhythm envelope');
assert.deepEqual([...world.matchAll(/\{ name: '[^']+', floor: (\d+)/g)].map((match) => Number(match[1])), [0, 30, 70, 115, 165]);

console.log(JSON.stringify({
  ok: true,
  mode: 'sapstick-canopy-sparse-skill-flow',
  corridor: { left: leftWall, right: rightWall, width: rightWall - leftWall },
  density: {
    grove: { branches: grove.filter((s) => s.branch).length, tiers: grove.length },
    saprun: { branches: saprun.filter((s) => s.branch).length, tiers: saprun.length },
    slingshot: { branches: slingshot.filter((s) => s.branch).length, tiers: slingshot.length },
  },
  teaching: { standingGap: standingTeachingGap, laterFlowGap },
  jumpEnvelope: samples.map(({ label, speed, flow: flowCount, vy, apex: height }) => ({ label, speed, flow: flowCount, launchVy: Number(vy.toFixed(1)), ballisticApex: Number(height.toFixed(1)) })),
  sapStick: { range: stickRange, tetherSeconds: stickHold, reuseLockSeconds: stickReuse, releaseApex: Number(apex(stickReleaseVy).toFixed(1)) },
}, null, 2));