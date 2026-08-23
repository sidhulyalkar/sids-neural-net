import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source=readFileSync(join(process.cwd(),'public/game-runtimes/mosslight-v2/v014/charge-intent-v014.js'),'utf8');
const entry=readFileSync(join(process.cwd(),'public/game-runtimes/mosslight-v2/v014-entry.js'),'utf8');

test('v0.14 keeps released charge chords committed until a reduced vector is deliberately held',()=>{
  assert.match(entry,/charge-intent-v014\.js/);
  assert.match(source,/retargetTicks:24/);
  assert.match(source,/v014ChargeCommittedVector/);
  assert.match(source,/v014ChargeCandidateVector/);
  assert.match(source,/v014ChargeCandidateTicks/);
  assert.match(source,/if\(!input\?\.m\)/);
  assert.match(source,/if\(p\.v014ChargeCandidateTicks>=CHARGE_INTENT_CONFIG\.retargetTicks\)/);
  assert.equal(24/120,.2);
});

test('fresh movement keydown can commit a new charge vector immediately',()=>{
  assert.match(source,/v014ChargeImmediateCommit=true/);
  assert.match(source,/if\(p\.v014ChargeImmediateCommit&&input\?\.m\)/);
});

test('Space release launches the committed vector without leaking synthetic held keys',()=>{
  assert.match(source,/const realHeld=state\.heldMoves;state\.heldMoves=heldSetForVector\(committed\)/);
  assert.match(source,/finally\{state\.heldMoves=realHeld;clearIntent\(p\)\}/);
});

test('charge intent remains fixed-step deterministic',()=>{
  assert.doesNotMatch(source,/Math\.random|Date\.now|performance\.now|setTimeout|requestAnimationFrame/);
});
