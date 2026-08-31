import assert from 'node:assert/strict';
import test from 'node:test';
import { reactionTrustAuthority, reactionTrustQuarantined } from '../lib/frontier/reactionTrust';

test('a quarantined reaction cue has exactly zero recommendation authority', () => {
  const unreliable = {
    observed: 12,
    confirmed: 1,
    contradicted: 8,
    confidenceSum: 9,
  };
  assert.equal(reactionTrustQuarantined(unreliable), true);
  assert.equal(reactionTrustAuthority(unreliable), 0);
});

test('a well-confirmed reaction cue remains available below explicit-action authority', () => {
  const reliable = {
    observed: 12,
    confirmed: 8,
    contradicted: 1,
    confidenceSum: 9,
  };
  assert.equal(reactionTrustQuarantined(reliable), false);
  assert.ok(reactionTrustAuthority(reliable) > 0.85);
  assert.ok(reactionTrustAuthority(reliable) <= 1.15);
});
