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
  { tick: 2, action: 7 },
  { tick: 5, action: 4 },
  { tick: 6, action: 5 },
  { tick: 18, action: 11 },
  { tick: 42, action: 8 },
  { tick: 75, action: 2 },
  { tick: 76, action: 3 },
  { tick: 92, action: 10 },
  { tick: 150, action: 0 },
  { tick: 151, action: 1 },
  { tick: 180, action: 9 },
];

test('authoritative engine hash fingerprints simulation sources only', () => {
  const hash = sylvariaAuthoritativeEngineHash();
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('the exact production simulation produces the same state for the same tick replay', () => {
  const first = simulateSylvariaReplay(SAMPLE_REPLAY, 480, { allowIncomplete: true });
  const second = simulateSylvariaReplay(SAMPLE_REPLAY, 480, { allowIncomplete: true });
  assert.equal(first.engineHash, second.engineHash);
  assert.equal(first.stateHash, second.stateHash);
  assert.equal(first.score, second.score);
  assert.equal(first.worldDepth, second.worldDepth);
  assert.deepEqual(first.stats, second.stats);
  assert.deepEqual(first.player, second.player);
});

test('server replay verification recomputes score instead of trusting the claim', () => {
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

test('headless verifier rejects physically impossible repeated movement keydown history', () => {
  assert.throws(
    () => simulateSylvariaReplay([{ tick: 1, action: 6 }, { tick: 2, action: 6 }], 10, { allowIncomplete: true }),
    /repeated D down while key is held/,
  );
});

test('headless verifier accepts down and up on the same simulation tick in recorded order', () => {
  const summary = simulateSylvariaReplay([{ tick: 1, action: 6 }, { tick: 1, action: 7 }], 30, { allowIncomplete: true });
  assert.equal(summary.stats.dashes, 1);
  assert.equal(summary.ended, false);
});

test('ranked replay verification fails closed when its CPU budget is exhausted', () => {
  const envelope = makeSylvariaReplayEnvelope(SAMPLE_REPLAY, 480);
  assert.throws(
    () => verifySylvariaReplay(envelope, 0, { allowIncomplete: true, maxWallMs: 0 }),
    /exceeded CPU budget/,
  );
});
