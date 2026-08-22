import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const runtime = 'public/game-runtimes/mosslight-v2';
const combat = readFileSync(join(root, runtime, 'v013/kinetic-combat-v013.js'), 'utf8');
const presentation = readFileSync(join(root, runtime, 'v013/kinetic-presentation-v013.js'), 'utf8');
const entry = readFileSync(join(root, runtime, 'v013-entry.js'), 'utf8');

const DT = 1 / 120;
const DECAY = 0.90483742;

function solvedInitialSpeed(distance: number, ticks: number) {
  return distance * (1 - DECAY) / (DT * (1 - DECAY ** ticks));
}

function integratedDistance(distance: number, ticks: number) {
  let speed = solvedInitialSpeed(distance, ticks);
  let traveled = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    traveled += speed * DT;
    speed *= DECAY;
  }
  return traveled;
}

test('reactive blade parry is exactly five 120 Hz ticks and replaces midpoint Countercut timing', () => {
  assert.match(combat, /parryWindow:5\/120/);
  assert.match(combat, /s\.phaseTime>s\.parryWindow/);
  assert.match(combat, /perfectReflectSpeed:1160/);
  assert.match(combat, /'PARRY'/);
  assert.doesNotMatch(combat, /Math\.abs\(s\.activeProgress-\.5\)/);
  assert.doesNotMatch(combat, /perfectWindow:\.12/);
  assert.equal(5 * DT, 1 / 24);
});

test('charged dash uses a deterministic discrete exponential whose geometric sum matches target distance', () => {
  assert.match(combat, /dashDecay:\.90483742/);
  assert.match(combat, /dashTicksMin:12/);
  assert.match(combat, /dashTicksMax:22/);
  assert.match(combat, /dashDistanceMin:78/);
  assert.match(combat, /dashDistanceMax:154/);
  assert.match(combat, /distance\*\(1-decay\)\/\(FIXED_DT\*\(1-Math\.pow\(decay,ticks\)\)\)/);
  assert.match(combat, /p\.dash\.speed=q\(p\.dash\.speed\*p\.dash\.decay\)/);

  for (const [distance, ticks] of [[78, 12], [116, 17], [154, 22]] as const) {
    const initial = solvedInitialSpeed(distance, ticks);
    let prior = initial;
    for (let tick = 1; tick < ticks; tick += 1) {
      const next = prior * DECAY;
      assert.ok(next < prior, `dash speed did not decay at tick ${tick}`);
      prior = next;
    }
    assert.ok(Math.abs(integratedDistance(distance, ticks) - distance) < 1e-8);
  }
});

test('Space dash input has a short deterministic buffer and recovery release path', () => {
  assert.match(combat, /dashBuffer:\.10/);
  assert.match(combat, /function queueDashBuffer/);
  assert.match(combat, /p\.dashBufferReleased=true/);
  assert.match(combat, /if\(!p\.dash&&!p\.dashCharging&&p\.dashCooldown<=0\)/);
  assert.match(combat, /releaseDashCharge\(\)/);
});

test('dash recovery can cancel into the tongue blade only after minimum commitment', () => {
  assert.match(combat, /dashCancelTicks:4/);
  assert.match(combat, /function cancelDashIntoBlade/);
  assert.match(combat, /p\.dash\.elapsedTicks<KINETIC_CONFIG\.dashCancelTicks/);
  assert.match(combat, /dashCancelled\?2\/120:KINETIC_CONFIG\.arcWindup/);
  assert.match(combat, /p\.dashEcho=13\/120/);
});

test('blade trail and selective hit-stop are procedural presentation feedback, not alternate simulation clocks', () => {
  assert.match(combat, /state\.bladeTrails\.push/);
  assert.match(combat, /signalHitStop\('parry',4\)/);
  assert.match(combat, /signalHitStop\([^\n]+?'enemy',1\)/);
  assert.match(combat, /'armor'/);
  assert.match(presentation, /function drawBladeTrails/);
  assert.match(presentation, /ctx\.arc\(t\.x,t\.y,t\.reach\*\.96/);
  assert.match(presentation, /kind==='parry'\?2:1/);
  assert.match(presentation, /if\(holdFrames>0\)\{holdFrames--;return\}/);
  assert.doesNotMatch(combat, /setTimeout|requestAnimationFrame|performance\.now/);
});

test('v0.13 production surfaces advertise the reactive blade grammar', () => {
  for (const flag of ['exponentialDash:true', 'bufferedDash:true', 'dashBladeCancel:true', 'reactiveBladeParry:true', 'proceduralBladeTrail:true', 'selectiveHitStop:true']) {
    assert.ok(entry.includes(flag), `missing v0.13 surface flag ${flag}`);
  }
  assert.match(entry, /first five active tongue ticks/i);
  assert.match(entry, /Queue Space/i);
  assert.doesNotMatch(entry, /Sylvararia013/);
});
