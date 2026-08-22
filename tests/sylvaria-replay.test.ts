import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SYLVARIA_ENGINE_VERSION,
  SYLVARIA_MAX_REPLAY_EVENTS,
  SYLVARIA_MAX_REPLAY_TICKS,
  SYLVARIA_OFFICIAL_SEED,
  SYLVARIA_REPLAY_SCHEMA,
  decodeSylvariaReplayEvents,
  encodeSylvariaReplayEvents,
  sylvariaActionName,
  sylvariaReplayBytesFromBase64Url,
  sylvariaReplayBytesToBase64Url,
  validateSylvariaReplayEnvelope,
  type SylvariaReplayEvent,
} from '../src/lib/sylvaria/replay';

const HASH = 'a'.repeat(64);

test('Sylvaria v0.13 replay varints round-trip glide cut and dash-charge input exactly', () => {
  const events: SylvariaReplayEvent[] = [
    { tick: 1, action: 6 },
    { tick: 1, action: 12 },
    { tick: 8, action: 13 },
    { tick: 8, action: 11 },
    { tick: 19, action: 4 },
    { tick: 19, action: 8 },
    { tick: 140_000, action: 5 },
  ];
  const bytes = encodeSylvariaReplayEvents(events);
  assert.deepEqual(decodeSylvariaReplayEvents(bytes), events);
  assert.ok(bytes.byteLength < events.length * 5);
  assert.equal(SYLVARIA_REPLAY_SCHEMA, 2);
  assert.equal(SYLVARIA_ENGINE_VERSION, '0.13.0');
  assert.equal(sylvariaActionName(11), 'cut-right');
  assert.equal(sylvariaActionName(12), 'dash-down');
  assert.equal(sylvariaActionName(13), 'dash-up');
});

test('simultaneous replay events use zero tick delta without losing action code zero', () => {
  const events: SylvariaReplayEvent[] = [
    { tick: 9, action: 3 },
    { tick: 9, action: 0 },
    { tick: 9, action: 12 },
  ];
  assert.deepEqual(decodeSylvariaReplayEvents(encodeSylvariaReplayEvents(events)), events);
});

test('replay codec rejects non-monotonic, out-of-range and oversized inputs', () => {
  assert.throws(() => encodeSylvariaReplayEvents([{ tick: 0, action: 0 }]), /tick 1 or later/);
  assert.throws(
    () => encodeSylvariaReplayEvents([{ tick: 3, action: 0 }, { tick: 2, action: 1 }]),
    /monotonic/,
  );
  assert.throws(
    () => encodeSylvariaReplayEvents([{ tick: SYLVARIA_MAX_REPLAY_TICKS + 1, action: 0 }]),
    /tick limit/,
  );
  assert.throws(
    () => encodeSylvariaReplayEvents(Array.from({ length: SYLVARIA_MAX_REPLAY_EVENTS + 1 }, (_, index) => ({ tick: index + 1, action: 0 as const }))),
    /exceeds .* events/,
  );
  assert.throws(() => encodeSylvariaReplayEvents([{ tick: 1, action: 14 as never }]), /action code/);
});

test('replay decoder rejects malformed and non-canonical varints', () => {
  assert.throws(() => decodeSylvariaReplayEvents(Uint8Array.from([0x80])), /truncated/);
  assert.throws(() => decodeSylvariaReplayEvents(Uint8Array.from([0x90, 0x00])), /non-canonical/);
  assert.throws(() => decodeSylvariaReplayEvents(Uint8Array.from([0x0e])), /action code/);
});

test('base64url transport is canonical and round-trips encoded bytes', () => {
  const bytes = encodeSylvariaReplayEvents([{ tick: 17, action: 12 }, { tick: 18, action: 13 }]);
  const encoded = sylvariaReplayBytesToBase64Url(bytes);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(sylvariaReplayBytesFromBase64Url(encoded), bytes);
  assert.throws(() => sylvariaReplayBytesFromBase64Url(`${encoded}=`), /base64url/);
});

test('replay envelope validates engine identity official seed duration and trailing input', () => {
  const bytes = encodeSylvariaReplayEvents([{ tick: 4, action: 6 }, { tick: 12, action: 7 }]);
  const envelope = {
    schema: SYLVARIA_REPLAY_SCHEMA,
    engineVersion: SYLVARIA_ENGINE_VERSION,
    engineHash: HASH,
    seed: SYLVARIA_OFFICIAL_SEED,
    durationTicks: 12,
    input: sylvariaReplayBytesToBase64Url(bytes),
  };
  assert.deepEqual(validateSylvariaReplayEnvelope(envelope), envelope);
  assert.throws(() => validateSylvariaReplayEnvelope({ ...envelope, schema: 1 }), /unsupported Sylvaria replay schema/);
  assert.throws(() => validateSylvariaReplayEnvelope({ ...envelope, seed: 7 }), /official seed/);
  assert.throws(() => validateSylvariaReplayEnvelope({ ...envelope, engineHash: 'not-a-hash' }), /SHA-256/);
  assert.throws(() => validateSylvariaReplayEnvelope({ ...envelope, durationTicks: 11 }), /after declared duration/);
});
