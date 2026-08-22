import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/combat-flow-v014.js'),
  'utf8',
);
const DT = 1 / 120;

test('v0.14 buffers blade intent instead of violating the four-tick dash commitment', () => {
  assert.match(source, /bladeBuffer:7\/120/);
  assert.match(source, /dashCommitTicks:4/);
  assert.match(source, /p\.dash\?\.reactive&&p\.dash\.elapsedTicks<FLOW_CONFIG\.dashCommitTicks/);
  assert.match(source, /if\(preCommit\)return queueBlade\(direction\)/);
  assert.match(source, /if\(p\.dash\?\.reactive&&p\.dash\.elapsedTicks<FLOW_CONFIG\.dashCommitTicks\)return false/);
  assert.equal(4 * DT, 1 / 30);
  assert.equal(7 * DT, 7 / 120);
});

test('late recovery input has a deterministic seven-tick grace window', () => {
  assert.match(source, /if\(p\.cutCooldown<=FLOW_CONFIG\.bladeBuffer\)return queueBlade\(direction\)/);
  assert.match(source, /if\(canReleaseQueuedBlade\(p\)\)/);
  assert.match(source, /p\.bladeQueuedDirection=null;p\.bladeBuffer=0;F\.cut\(direction\)/);
});

test('committed dash steering rotates the dash direction without changing scalar decay math', () => {
  assert.match(source, /dashSteerBlend:\.055/);
  assert.match(source, /function steerCommittedDash/);
  assert.match(source, /p\.dash\.dir=\{x:steered\.x,y:steered\.y\}/);
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

test('Flow improves tempo without widening the five-tick parry window', () => {
  assert.match(source, /recoveryTicksAtFullFlow:7/);
  assert.match(source, /parryDashRefund:12\/120/);
  assert.match(source, /state\.player\.dashCooldown=q\(Math\.max\(0,\(state\.player\.dashCooldown\|\|0\)-refund\)\)/);
  assert.doesNotMatch(source, /parryWindow/);

  const baseRecovery = 10 * DT;
  const fullFlowRecovery = 7 * DT;
  assert.equal(baseRecovery - fullFlowRecovery, 3 * DT);
  assert.equal(12 * DT, 0.1);
});

test('flow layer remains fixed-step deterministic and contains no browser-clock gameplay APIs', () => {
  assert.doesNotMatch(source, /requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/);
});
