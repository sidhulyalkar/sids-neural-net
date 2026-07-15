import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blendshapesToEmotion,
  emotionToTokens,
  neutralReading,
  smoothReading,
  type EmotionReading,
} from '../components/sensing/emotion';

function reading(
  dominant: EmotionReading['dominant'],
  intensity: number,
): EmotionReading {
  const scores = neutralReading().scores;
  for (const emotion of Object.keys(scores) as Array<keyof typeof scores>) {
    scores[emotion] = emotion === dominant ? 1 : 0;
  }
  return { scores, dominant, intensity };
}

test('a resting face maps to calm with a normalized distribution', () => {
  const result = blendshapesToEmotion({});

  assert.equal(result.dominant, 'calm');
  assert.equal(result.intensity, 0);
  assert.equal(result.scores.calm, 1);
  assert.ok(Math.abs(Object.values(result.scores).reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('a symmetric smile maps to joy', () => {
  const result = blendshapesToEmotion({
    mouthSmileLeft: 1,
    mouthSmileRight: 1,
    cheekSquintLeft: 0.8,
    cheekSquintRight: 0.8,
  });

  assert.equal(result.dominant, 'joy');
  assert.equal(result.intensity, 1);
  assert.ok(result.scores.joy > result.scores.calm);
});

test('strong brow and mouth tension maps to anger', () => {
  const result = blendshapesToEmotion({
    browDownLeft: 1,
    browDownRight: 1,
    mouthPressLeft: 0.7,
    mouthPressRight: 0.7,
    noseSneerLeft: 0.6,
    noseSneerRight: 0.6,
    jawForward: 0.3,
  });

  assert.equal(result.dominant, 'anger');
  assert.ok(result.intensity > 0.9);
});

test('EMA smoothing interpolates scores and intensity without mutating its inputs', () => {
  const previous = neutralReading();
  const next = reading('joy', 1);
  const result = smoothReading(previous, next, 0.25);

  assert.deepEqual(result.scores, {
    joy: 0.25,
    calm: 0.75,
    surprise: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
  });
  assert.equal(result.dominant, 'calm');
  assert.equal(result.intensity, 0.25);
  assert.deepEqual(previous, neutralReading());
  assert.deepEqual(next, reading('joy', 1));
});

test('EMA alpha is clamped to a safe range', () => {
  const previous = neutralReading();
  const next = reading('surprise', 0.8);

  assert.deepEqual(smoothReading(previous, next, -1), previous);
  assert.deepEqual(smoothReading(previous, next, 2), next);
});

test('calm tokens preserve the default cyan accent', () => {
  const tokens = emotionToTokens(neutralReading());

  assert.deepEqual(tokens.accentRGB, [102, 227, 255]);
  assert.equal(tokens.dominant, 'calm');
  assert.equal(tokens.intensity, 0);
});

test('extreme emotions produce more glow and accent shift than mild ones', () => {
  const mild = emotionToTokens(reading('anger', 0.2));
  const extreme = emotionToTokens(reading('anger', 1));

  assert.ok(extreme.glow > mild.glow);
  assert.ok(extreme.accentRGB[0] >= mild.accentRGB[0]);
  assert.ok(extreme.accentRGB[1] < mild.accentRGB[1]);
  assert.ok(extreme.accentRGB[2] < mild.accentRGB[2]);
});

test('token intensity is clamped before affecting color and glow', () => {
  const overdriven = emotionToTokens(reading('joy', 10));
  const maximum = emotionToTokens(reading('joy', 1));

  assert.deepEqual(overdriven, maximum);
});
