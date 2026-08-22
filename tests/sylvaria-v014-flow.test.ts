import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/combat-flow-v014.js'),
  'utf8',
);
const DT = 1 / 120;
const DECAY = 0.90483742;
const near = (actual: number, expected: number, epsilon = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const solvedOpeningSpeed = (distance: number, ticks: number) =>
  distance * (1 - DECAY) / (DT * (1 - DECAY ** ticks));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

test('v0.14 buffers blade intent instead of violating the four-tick dash commitment', () => {
  assert.match(source, /bladeBuffer:7\/120/);
  assert.match(source, /dashCommitTicks:4/);
  assert.match(source, /p\.dash\?\.reactive&&p\.dash\.elapsedTicks<FLOW_CONFIG\.dashCommitTicks/);
  assert.match(source, /if\(preCommit\)return queueBlade\(direction\)/);
  assert.match(source, /if\(p\.dash\?\.reactive&&p\.dash\.elapsedTicks<FLOW_CONFIG\.dashCommitTicks\)return false/);
  near(4 * DT, 1 / 30);
  near(7 * DT, 7 / 120);
});

test('late recovery input has a deterministic seven-tick grace window', () => {
  assert.match(source, /if\(p\.cutCooldown<=FLOW_CONFIG\.bladeBuffer\)return queueBlade\(direction\)/);
  assert.match(source, /if\(canReleaseQueuedBlade\(p\)\)/);
  assert.match(source, /p\.bladeQueuedDirection=null;p\.bladeBuffer=0;F\.cut\(direction\)/);
});

test('charged dash release honors the last displayed charge vector after movement keys are released', () => {
  assert.match(source, /function heldSetForVector/);
  assert.match(source, /const inheritedReleaseDashCharge=F\.releaseDashCharge/);
  assert.match(source, /p\.dashChargeVector/);
  assert.match(source, /state\.heldMoves=heldSetForVector\(remembered\)/);
  assert.match(source, /finally\{state\.heldMoves=realHeld\}/);
  assert.match(source, /window\.addEventListener\?\.\('keyup',onFlowSpaceUp,true\)/);
});

test('committed dash steering rotates direction without injecting ordinary glide speed', () => {
  assert.match(source, /dashSteerBlend:\.055/);
  assert.match(source, /function steerCommittedDash/);
  assert.match(source, /p\.dash\.dir=\{x:steered\.x,y:steered\.y\}/);
  assert.match(source, /if\(dashRef\)state\.heldMoves=new Set\(\)/);
  assert.match(source, /finally\{if\(dashRef\)state\.heldMoves=held\}/);
  assert.doesNotMatch(source, /p\.dash\.speed\s*=/);

  let x = 1;
  let y = 0;
  for (let tick = 0; tick < 6; tick += 1) {
    const bx = x * 0.945;
    const by = y * 0.945 + 0.055;
    const length = Math.hypot(bx, by);
    x = bx / length;
    y = by / length;
  }
  assert.ok(x > 0.9, `six ticks should preserve dash commitment, x=${x}`);
  assert.ok(y > 0.25, `six ticks should permit visible course correction, y=${y}`);
});

test('v0.14 reports the player-reachable dash envelope rather than dormant zero-charge endpoints', () => {
  assert.match(source, /minimumReleaseCharge:\.12/);
  assert.match(source, /DASH_DISTANCE_ENVELOPE/);
  assert.match(source, /DASH_SPEED_ENVELOPE/);
  assert.match(source, /tapMin:TAP_DASH\.distance/);
  assert.match(source, /fullMax:FULL_DASH\.distance/);
  assert.match(source, /lastDashAccuracy/);
  assert.match(source, /pathTravel:q\(dashRef\.v014PathTravel\|\|0\)/);

  const curve = smoothstep(0.12);
  const tapDistance = 78 + (154 - 78) * curve;
  const tapTicks = Math.round(12 + (22 - 12) * curve);
  const tapSpeed = solvedOpeningSpeed(tapDistance, tapTicks);
  const fullSpeed = solvedOpeningSpeed(154, 22);
  near(tapDistance, 81.020544);
  assert.equal(tapTicks, 12);
  assert.ok(tapSpeed > 1323 && tapSpeed < 1325, `unexpected tap opening speed ${tapSpeed}`);
  assert.ok(fullSpeed > 1977 && fullSpeed < 1979, `unexpected full opening speed ${fullSpeed}`);
});

test('Flow improves tempo without widening the five-tick parry window', () => {
  assert.match(source, /recoveryTicksAtFullFlow:7/);
  assert.match(source, /parryDashRefund:12\/120/);
  assert.match(source, /state\.player\.dashCooldown=q\(Math\.max\(0,\(state\.player\.dashCooldown\|\|0\)-refund\)\)/);
  assert.doesNotMatch(source, /parryWindow/);

  const baseRecovery = 10 * DT;
  const fullFlowRecovery = 7 * DT;
  near(baseRecovery - fullFlowRecovery, 3 * DT);
  near(12 * DT, 0.1);
});

test('flow layer remains fixed-step deterministic and contains no browser-clock gameplay APIs', () => {
  assert.doesNotMatch(source, /requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/);
});
