import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePreference,
  applyBehaviorEvent,
  behavioralAdjustment,
  createInitialBehaviorModel,
  startBehaviorSession,
} from '../lib/frontier/behavior';
import {
  ReactionInferenceEngine,
  scoreReactionCues,
  type FrontierReactionFaceInput,
} from '../lib/frontier/reaction';
import type { FrontierItem } from '../lib/frontier/types';

const neutralExpressions = {
  smile: 0.02,
  browRaise: 0.03,
  browFurrow: 0.02,
  eyeWide: 0.02,
  eyeSquint: 0.03,
  jawOpen: 0.01,
  mouthPress: 0.02,
};

function face(overrides: Partial<FrontierReactionFaceInput> = {}): FrontierReactionFaceInput {
  return {
    active: true,
    yaw: 0,
    pitch: 0,
    stillness: 0.72,
    expressions: { ...neutralExpressions },
    ...overrides,
  };
}

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'reaction-signal',
    title: 'A surprising visual computing technique',
    summary: 'A high quality creative technical signal.',
    url: 'https://example.com/reaction-signal',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'github',
    publishedAt: '2026-08-29T12:00:00.000Z',
    lane: 'creative_tech',
    tags: ['creative coding', 'graphics', 'visual computing'],
    baseScore: 0.62,
    importance: 0.58,
    novelty: 0.76,
    quality: 0.84,
    momentum: 0.66,
    ...overrides,
  };
}

test('reaction cue scoring separates positive, surprise, and friction expression patterns', () => {
  const baseline = { ...neutralExpressions };
  const affinity = scoreReactionCues(face({ expressions: { ...baseline, smile: 0.82, eyeSquint: 0.35 } }), baseline);
  const surprise = scoreReactionCues(face({ expressions: { ...baseline, browRaise: 0.7, eyeWide: 0.82, jawOpen: 0.52 } }), baseline);
  const friction = scoreReactionCues(face({ expressions: { ...baseline, browFurrow: 0.8, mouthPress: 0.67 } }), baseline);

  assert.ok(affinity.affinity > affinity.surprise);
  assert.ok(surprise.surprise > surprise.affinity);
  assert.ok(friction.friction > friction.affinity);
});

test('reaction inference requires calibration, sustained evidence, and a per-card cooldown', () => {
  const engine = new ReactionInferenceEngine({
    calibrationMs: 10,
    minimumCalibrationSamples: 2,
    emaAlpha: 1,
    minConfidence: 0.6,
    minMargin: 0.1,
    minDurationMs: 50,
    cooldownMs: 100,
  });
  const neutral = face();
  const smiling = face({ expressions: { ...neutralExpressions, smile: 0.9, eyeSquint: 0.45 } });

  assert.equal(engine.push(neutral, 'card-a', 0).phase, 'calibrating');
  assert.equal(engine.push(neutral, 'card-a', 10).phase, 'calibrating');
  assert.equal(engine.push(smiling, 'card-a', 20).reaction, undefined);

  const emitted = engine.push(smiling, 'card-a', 80).reaction;
  assert.equal(emitted?.kind, 'affinity');
  assert.ok((emitted?.confidence ?? 0) >= 0.6);

  assert.equal(engine.push(smiling, 'card-a', 90).reaction, undefined);
  assert.equal(engine.push(smiling, 'card-a', 150).reaction, undefined);
  assert.equal(engine.push(smiling, 'card-a', 190).reaction?.kind, 'affinity');
});

test('changing cards resets a pending reaction instead of leaking evidence across content', () => {
  const engine = new ReactionInferenceEngine({
    calibrationMs: 1,
    minimumCalibrationSamples: 1,
    emaAlpha: 1,
    minConfidence: 0.6,
    minMargin: 0.1,
    minDurationMs: 60,
    cooldownMs: 100,
  });
  const neutral = face();
  const surprised = face({ expressions: { ...neutralExpressions, browRaise: 0.8, eyeWide: 0.9, jawOpen: 0.55 } });

  engine.push(neutral, 'card-a', 0);
  engine.push(surprised, 'card-a', 2);
  assert.equal(engine.push(surprised, 'card-b', 50).reaction, undefined);
  assert.equal(engine.push(surprised, 'card-b', 80).reaction, undefined);
  assert.equal(engine.push(surprised, 'card-b', 115).reaction?.kind, 'surprise');
});

test('ambient affinity is weak positive evidence while friction alone never becomes dislike', () => {
  const signal = item();
  const when = new Date('2026-08-30T11:30:00');
  let affinityModel = createInitialBehaviorModel();
  let frictionModel = createInitialBehaviorModel();

  for (let index = 0; index < 5; index += 1) {
    affinityModel = applyBehaviorEvent(affinityModel, signal, { kind: 'impression' }, when);
    affinityModel = applyBehaviorEvent(affinityModel, signal, {
      kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 0.9, intensity: 0.7, durationMs: 1_400,
    }, when);
    frictionModel = applyBehaviorEvent(frictionModel, signal, { kind: 'impression' }, when);
    frictionModel = applyBehaviorEvent(frictionModel, signal, {
      kind: 'ambient_reaction', ambientReaction: 'friction', confidence: 0.95, intensity: 0.9, durationMs: 1_800,
    }, when);
  }

  const affinityPreference = aggregatePreference(affinityModel.topicStats['visual computing'], when);
  const frictionPreference = aggregatePreference(frictionModel.topicStats['visual computing'], when);
  assert.ok(affinityPreference.score > 0);
  assert.ok(affinityPreference.score < 0.35);
  assert.ok(frictionPreference.score >= 0);
});

test('explicit feedback remains materially stronger than ambient reaction evidence', () => {
  const signal = item();
  const when = new Date('2026-08-30T11:30:00');
  let ambientOnly = createInitialBehaviorModel();
  let explicit = createInitialBehaviorModel();

  for (let index = 0; index < 4; index += 1) {
    ambientOnly = applyBehaviorEvent(ambientOnly, signal, { kind: 'impression' }, when);
    ambientOnly = applyBehaviorEvent(ambientOnly, signal, {
      kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 0.92, intensity: 0.8, durationMs: 1_500,
    }, when);
    explicit = applyBehaviorEvent(explicit, signal, { kind: 'impression' }, when);
  }
  explicit = applyBehaviorEvent(explicit, signal, { kind: 'positive' }, when);
  explicit = applyBehaviorEvent(explicit, signal, { kind: 'save' }, when);

  const ambientPreference = aggregatePreference(ambientOnly.laneStats.creative_tech, when);
  const explicitPreference = aggregatePreference(explicit.laneStats.creative_tech, when);
  assert.ok(explicitPreference.score > ambientPreference.score);
  assert.ok(explicitPreference.confidence > ambientPreference.confidence);
});

test('current-session ambient reactions cannot reshuffle the frozen ranking snapshot', () => {
  const signal = item();
  const prior = new Date('2026-08-29T11:00:00');
  const session = new Date('2026-08-30T11:00:00');
  let model = createInitialBehaviorModel();
  for (let index = 0; index < 4; index += 1) {
    model = applyBehaviorEvent(model, signal, { kind: 'impression' }, prior);
    model = applyBehaviorEvent(model, signal, { kind: 'open' }, prior);
  }
  model = startBehaviorSession(model, session);
  const before = behavioralAdjustment(signal, model, session);
  model = applyBehaviorEvent(model, signal, {
    kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 1, intensity: 1, durationMs: 2_000,
  }, new Date('2026-08-30T11:05:00'));
  const after = behavioralAdjustment(signal, model, session);
  assert.equal(after, before);
});
