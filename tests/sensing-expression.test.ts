import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blendshapesToExpression,
  expressionToTokens,
  neutralReading,
  smoothReading,
} from '../components/sensing/expression';

test('resting input remains neutral without inventing psychological labels', () => {
  const result = blendshapesToExpression({});
  assert.deepEqual(result, neutralReading());
  assert.equal(result.intensity, 0);
  assert.equal(result.signals.stillness, 1);
});

test('symmetric smile is represented as visible smile activation', () => {
  const result = blendshapesToExpression({
    mouthSmileLeft: 1,
    mouthSmileRight: 1,
    cheekSquintLeft: 0.8,
    cheekSquintRight: 0.8,
  });
  assert.ok(result.signals.smileActivation > 0.9);
  assert.ok(result.signals.facialActivity > 0.9);
  assert.equal('dominant' in result, false);
  assert.equal('scores' in result, false);
});

test('brow and mouth movement remain separate observable dimensions', () => {
  const result = blendshapesToExpression({
    browDownLeft: 1,
    browDownRight: 1,
    mouthPressLeft: 0.7,
    mouthPressRight: 0.7,
    jawOpen: 0.4,
  });
  assert.equal(result.signals.browActivity, 1);
  assert.ok(result.signals.mouthActivity >= 0.7);
  assert.equal(result.signals.smileActivation, 0);
});

test('left/right divergence produces asymmetry without assigning meaning', () => {
  const result = blendshapesToExpression({ mouthSmileLeft: 1, mouthSmileRight: 0.1 });
  assert.ok(result.signals.expressionAsymmetry >= 0.89);
});

test('EMA smoothing interpolates every signal without mutating inputs', () => {
  const previous = neutralReading();
  const next = blendshapesToExpression({ mouthSmileLeft: 1, mouthSmileRight: 1 });
  const result = smoothReading(previous, next, 0.25);
  assert.equal(result.signals.smileActivation, 0.1875);
  assert.equal(previous.signals.smileActivation, 0);
  assert.equal(next.signals.smileActivation, 0.75);
});

test('smoothing alpha is clamped', () => {
  const previous = neutralReading();
  const next = blendshapesToExpression({ jawOpen: 1 });
  assert.deepEqual(smoothReading(previous, next, -1), previous);
  assert.deepEqual(smoothReading(previous, next, 2), next);
});

test('atmosphere stays at brand cyan at rest and reacts monotonically to activity', () => {
  const quiet = expressionToTokens(neutralReading());
  const active = expressionToTokens(blendshapesToExpression({ jawOpen: 1 }));
  assert.deepEqual(quiet.accentRGB, [102, 227, 255]);
  assert.ok(active.glow > quiet.glow);
  assert.ok(active.activity > quiet.activity);
});
