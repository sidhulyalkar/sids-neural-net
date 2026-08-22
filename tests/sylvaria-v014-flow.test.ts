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

test('released dash buffers become real dashes before the movement step that would otherwise inject glide speed', () => {
  assert.match(source, /function consumeReleasedDashBuffer/);
  assert.match(source, /const cooldownAfter=Math\.max\(0,\(p\.dashCooldown\|\|0\)-dt\),bufferAfter=Math\.max\(0,p\.dashBuffer-dt\)/);
  assert.match(source, /if\(cooldownAfter>0\|\|bufferAfter<=0\)return false/);
  assert.match(source, /p\.dashCharge=Math\.max\(\.18,queued\);F\.releaseDashCharge\(\)/);
  assert.match(source, /if\(p\)consumeReleasedDashBuffer\(p,dt\)/);
});

test('committed dash steering is expressive but hard-capped relative to the launch vector', () => {
  assert.match(source, /dashSteerBlend:\.055/);
  assert.match(source, /dashSteerMaxRadians:\.38/);
  assert.match(source, /function steerCommittedDash/);
  assert.match(source, /if\(!dash\.v014LaunchDir\)dash\.v014LaunchDir=\{x:d\.x,y:d\.y\}/);
  assert.match(source, /clamp\(angleDelta\(launchAngle,proposedAngle\),-FLOW_CONFIG\.dashSteerMaxRadians,FLOW_CONFIG\.dashSteerMaxRadians\)/);
  assert.match(source, /dash\.dir=\{x:q\(Math\.cos\(angle\)\),y:q\(Math\.sin\(angle\)\)\}/);
  assert.match(source, /if\(dashRef\)state\.heldMoves=new Set\(\)/);
  assert.match(source, /finally\{if\(dashRef\)state\.heldMoves=held\}/);
  assert.doesNotMatch(source, /p\.dash\.speed\s*=/);

  const cap = 0.38;
  assert.ok(Math.cos(cap) > 0.92, 'course-correction cap must retain strong launch-axis commitment');
  assert.ok(Math.sin(cap) > 0.36, 'course-correction cap must still create visible steering authority');
  assert.ok(cap * 180 / Math.PI < 22, 'committed dash should never bend 22 degrees or more');
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
