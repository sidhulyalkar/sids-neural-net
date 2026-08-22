import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemorySylvariaTicketStore,
  assertSylvariaReplayFitsTicketWindow,
  claimSylvariaRunTicket,
  createSylvariaAcceptedRunProof,
  issueSylvariaRunTicket,
  sylvariaRequestFingerprint,
  verifySylvariaRunTicketToken,
} from '../src/lib/sylvaria/leaderboard';

const SECRET = 'sylvaria-test-secret-32-bytes-minimum-value';
const ENGINE_HASH = 'b'.repeat(64);
const BUILD_SHA = 'test-build-013';
const NOW = 1_800_000_000_000;
const NONCE = '12345678-1234-4234-9234-123456789abc';

test('ranked run tickets are signed, current-engine bound and single-use', async () => {
  const store = new InMemorySylvariaTicketStore();
  const issued = await issueSylvariaRunTicket({
    secret: SECRET,
    store,
    now: NOW,
    ttlMs: 5 * 60_000,
    buildSha: BUILD_SHA,
    engineHash: ENGINE_HASH,
    nonce: NONCE,
    requestFingerprint: 'fingerprint',
  });
  const claims = verifySylvariaRunTicketToken(issued.token, SECRET, { now: NOW + 1000, engineHash: ENGINE_HASH, buildSha: BUILD_SHA });
  assert.equal(claims.nonce, NONCE);
  assert.equal(store.peek(NONCE)?.usedAt, null);

  const claimed = await claimSylvariaRunTicket({
    token: issued.token,
    secret: SECRET,
    store,
    now: NOW + 2000,
    engineHash: ENGINE_HASH,
    buildSha: BUILD_SHA,
  });
  assert.equal(claimed.usedAt, NOW + 2000);
  await assert.rejects(
    () => claimSylvariaRunTicket({ token: issued.token, secret: SECRET, store, now: NOW + 3000, engineHash: ENGINE_HASH, buildSha: BUILD_SHA }),
    /already used/,
  );
});

test('ranked replay duration must fit inside the age of its claimed ticket', () => {
  const ticket = {
    schema: 1 as const,
    engineVersion: '0.13.0' as const,
    engineHash: ENGINE_HASH,
    seed: 110001,
    buildSha: BUILD_SHA,
    nonce: NONCE,
    issuedAt: NOW,
    expiresAt: NOW + 20 * 60_000,
    requestFingerprint: null,
    usedAt: NOW + 5 * 60_000,
  };
  assert.doesNotThrow(() => assertSylvariaReplayFitsTicketWindow(ticket, 120 * 60 * 5));
  assert.doesNotThrow(() => assertSylvariaReplayFitsTicketWindow({ ...ticket, usedAt: NOW + 10_000 }, 120 * 14));
  assert.throws(
    () => assertSylvariaReplayFitsTicketWindow({ ...ticket, usedAt: NOW + 10_000 }, 120 * 60 * 5),
    /predates its run ticket/,
  );
});

test('fifty simultaneous claims of one valid ticket produce exactly one winner', async () => {
  const store = new InMemorySylvariaTicketStore();
  const nonce = '22345678-1234-4234-9234-123456789abc';
  const issued = await issueSylvariaRunTicket({
    secret: SECRET,
    store,
    now: NOW,
    ttlMs: 5 * 60_000,
    buildSha: BUILD_SHA,
    engineHash: ENGINE_HASH,
    nonce,
  });

  const attempts = await Promise.allSettled(
    Array.from({ length: 50 }, (_, index) => claimSylvariaRunTicket({
      token: issued.token,
      secret: SECRET,
      store,
      now: NOW + 2000 + index,
      engineHash: ENGINE_HASH,
      buildSha: BUILD_SHA,
    })),
  );

  const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
  const rejected = attempts.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one concurrent request may consume a ticket');
  assert.equal(rejected.length, 49, 'all duplicate concurrent claims must fail closed');
  assert.ok(store.peek(nonce)?.usedAt, 'the winning claim must persist the atomic used marker');
  for (const result of rejected) {
    assert.match(String(result.reason), /already used/);
  }
});

test('ticket verification rejects tampering, expiry and stale engine/build identity', async () => {
  const store = new InMemorySylvariaTicketStore();
  const { token } = await issueSylvariaRunTicket({ secret: SECRET, store, now: NOW, ttlMs: 60_000, buildSha: BUILD_SHA, engineHash: ENGINE_HASH, nonce: NONCE });
  const [payload, signature] = token.split('.');
  const tampered = `${payload}.${signature.slice(0, -1)}${signature.at(-1) === 'A' ? 'B' : 'A'}`;
  assert.throws(() => verifySylvariaRunTicketToken(tampered, SECRET, { now: NOW, engineHash: ENGINE_HASH }), /signature/);
  assert.throws(() => verifySylvariaRunTicketToken(token, SECRET, { now: NOW + 60_001, engineHash: ENGINE_HASH }), /expired/);
  assert.throws(() => verifySylvariaRunTicketToken(token, SECRET, { now: NOW, engineHash: 'c'.repeat(64) }), /engine hash is stale/);
  assert.throws(() => verifySylvariaRunTicketToken(token, SECRET, { now: NOW, engineHash: ENGINE_HASH, buildSha: 'other-build' }), /build SHA is stale/);
});

test('leaderboard secret length fails closed', async () => {
  const store = new InMemorySylvariaTicketStore();
  await assert.rejects(
    () => issueSylvariaRunTicket({ secret: 'short', store, now: NOW, buildSha: BUILD_SHA, engineHash: ENGINE_HASH }),
    /at least 32 bytes/,
  );
});

test('request fingerprints and accepted-run proofs are deterministic but bind every verified field', () => {
  const fingerprint = sylvariaRequestFingerprint(SECRET, ['198.51.100.0/24', 'browser-family']);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint, sylvariaRequestFingerprint(SECRET, ['198.51.100.0/24', 'browser-family']));

  const base = {
    secret: SECRET,
    engineVersion: '0.13.0',
    engineHash: ENGINE_HASH,
    buildSha: BUILD_SHA,
    ticketNonce: NONCE,
    replayHash: 'd'.repeat(64),
    stateHash: 'e'.repeat(64),
    score: 1234,
    durationTicks: 9000,
  };
  const proof = createSylvariaAcceptedRunProof(base);
  assert.match(proof, /^[a-f0-9]{64}$/);
  assert.equal(proof, createSylvariaAcceptedRunProof(base));
  assert.notEqual(proof, createSylvariaAcceptedRunProof({ ...base, score: 1235 }));
  assert.notEqual(proof, createSylvariaAcceptedRunProof({ ...base, replayHash: 'f'.repeat(64) }));
});
