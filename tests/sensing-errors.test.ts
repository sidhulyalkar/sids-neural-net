import assert from 'node:assert/strict';
import test from 'node:test';

import { isCameraPermissionDenied } from '../components/sensing/errors';

test('recognizes camera permission errors from standard Error instances', () => {
  const denied = new Error('Permission denied');
  denied.name = 'NotAllowedError';
  const insecure = new Error('Insecure context');
  insecure.name = 'SecurityError';

  assert.equal(isCameraPermissionDenied(denied), true);
  assert.equal(isCameraPermissionDenied(insecure), true);
});

test('recognizes browser-shaped permission errors without relying on DOMException', () => {
  assert.equal(isCameraPermissionDenied({ name: 'NotAllowedError' }), true);
  assert.equal(isCameraPermissionDenied({ name: 'SecurityError', message: 'blocked' }), true);
});

test('rejects unrelated and malformed failures', () => {
  assert.equal(isCameraPermissionDenied(new Error('camera missing')), false);
  assert.equal(isCameraPermissionDenied({ name: 'NotFoundError' }), false);
  assert.equal(isCameraPermissionDenied({ name: 42 }), false);
  assert.equal(isCameraPermissionDenied(null), false);
  assert.equal(isCameraPermissionDenied('NotAllowedError'), false);
});
