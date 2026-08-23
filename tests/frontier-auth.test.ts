import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  safeReturnPath,
  verifySessionToken,
} from '../lib/frontier/auth';

test('FRONTIER session tokens round-trip and reject tampering', () => {
  const previous = process.env.FRONTIER_AUTH_SECRET;
  process.env.FRONTIER_AUTH_SECRET = 'test-secret-with-enough-entropy-for-session-signing';
  try {
    const issued = new Date('2026-08-21T12:00:00Z');
    const token = createSessionToken({ sub: 'google-sub-123', email: 'reader@example.com', name: 'Reader' }, issued);
    const user = verifySessionToken(token, new Date('2026-08-22T12:00:00Z'));
    assert.deepEqual(user, { sub: 'google-sub-123', email: 'reader@example.com', name: 'Reader', picture: undefined });

    const [payload, signature] = token.split('.');
    assert.equal(verifySessionToken(`${payload}x.${signature}`, issued), null);
    assert.equal(verifySessionToken(token, new Date('2026-10-01T12:00:00Z')), null);
  } finally {
    if (previous === undefined) delete process.env.FRONTIER_AUTH_SECRET;
    else process.env.FRONTIER_AUTH_SECRET = previous;
  }
});

test('OAuth return path is limited to local paths', () => {
  assert.equal(safeReturnPath('/frontier?view=saved'), '/frontier?view=saved');
  assert.equal(safeReturnPath('https://evil.example/steal'), '/frontier');
  assert.equal(safeReturnPath('//evil.example/steal'), '/frontier');
  assert.equal(safeReturnPath(undefined), '/frontier');
});
