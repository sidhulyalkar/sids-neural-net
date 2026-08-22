import assert from 'node:assert/strict';
import test from 'node:test';

import {
  makeSylvariaReplayEnvelope,
  simulateSylvariaReplay,
  sylvariaAuthoritativeEngineHash,
  verifySylvariaReplay,
} from '../src/lib/sylvaria/headless';
import type { SylvariaReplayEvent } from '../src/lib/sylvaria/replay';

const SAMPLE_REPLAY: SylvariaReplayEvent[] = [
  { tick: 1, action: 6 },
  { tick: 18, action: 12 },
  { tick: 58, action: 13 },
  { tick: 72, action: 7 },
  { tick: 90, action: 11 },
  { tick: 128, action: 0 },
  { tick: 128, action: 6 },
  { tick: 158, action: 1 },
  { tick: 158, action: 7 },
  { tick: 180, action: 9 },
];

test('authoritative engine hash fingerprints v0.13 simulation sources only', () => {
  const hash = sylvariaAuthoritativeEngineHash();
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('the exact v0.13 production simulation produces the same state for the same tick replay', () => {
  const first = simulateSylvariaReplay(SAMPLE_REPLAY, 480, { allowIncomplete: true });
  const second = simulateSylvariaReplay(SAMPLE_REPLAY, 480, { allowIncomplete: true });
  assert.equal(first.engineVersion, '0.13.0');
  assert.equal(first.engineHash, second.engineHash);
  assert.equal(first.stateHash, second.stateHash);
  assert.equal(first.score, second.score);
  assert.equal(first.worldDepth, second.worldDepth);
  assert.deepEqual(first.stats, second.stats);
  assert.deepEqual(first.player, second.player);
  assert.ok((first.stats.dashes ?? 0) >= 1, 'charged Space replay should produce a dash');
  assert.ok((first.stats.kineticEnemies ?? 0) >= 1, 'v0.13 room should contain kinetic enemies');
});

test('server replay verification recomputes v0.13 score instead of trusting the claim', () => {
  const summary = simulateSylvariaReplay(SAMPLE_REPLAY, 360, { allowIncomplete: true });
  const envelope = makeSylvariaReplayEnvelope(SAMPLE_REPLAY, 360);
  const verified = verifySylvariaReplay(envelope, summary.score, { allowIncomplete: true });
  assert.equal(verified.score, summary.score);
  assert.equal(verified.stateHash, summary.stateHash);
  assert.match(verified.replayHash, /^[a-f0-9]{64}$/);
  assert.throws(
    () => verifySylvariaReplay(envelope, summary.score + 1, { allowIncomplete: true }),
    /does not match authoritative score/,
  );
});

test('headless verifier rejects physically impossible repeated held-key history for movement and dash', () => {
  assert.throws(
    () => simulateSylvariaReplay([{ tick: 1, action: 6 }, { tick: 2, action: 6 }], 10, { allowIncomplete: true }),
    /repeated D down while key is held/,
  );
  assert.throws(
    () => simulateSylvariaReplay([{ tick: 1, action: 12 }, { tick: 2, action: 12 }], 10, { allowIncomplete: true }),
    /repeated SPACE down while key is held/,
  );
});

test('held movement is continuous while Space dash remains an explicit charge release action', () => {
  const glide = simulateSylvariaReplay([{ tick: 1, action: 6 }, { tick: 31, action: 7 }], 45, { allowIncomplete: true });
  assert.equal(glide.stats.dashes, 0);
  assert.ok((glide.player?.x ?? 0) > 120, 'held D should produce sustained continuous travel');

  const dash = simulateSylvariaReplay([
    { tick: 1, action: 6 },
    { tick: 3, action: 12 },
    { tick: 35, action: 13 },
    { tick: 45, action: 7 },
  ], 70, { allowIncomplete: true });
  assert.equal(dash.stats.dashes, 1);
  assert.ok((dash.player?.x ?? 0) > (glide.player?.x ?? 0));
});

test('headless verifier accepts down and up on the same simulation tick in recorded order', () => {
  const summary = simulateSylvariaReplay([{ tick: 1, action: 6 }, { tick: 1, action: 7 }], 30, { allowIncomplete: true });
  assert.equal(summary.stats.dashes, 0);
  assert.equal(summary.ended, false);
});

test('ranked replay verification fails closed when its CPU budget is exhausted', () => {
  const envelope = makeSylvariaReplayEnvelope(SAMPLE_REPLAY, 480);
  assert.throws(
    () => verifySylvariaReplay(envelope, 0, { allowIncomplete: true, maxWallMs: 0 }),
    /exceeded CPU budget/,
  );
});
