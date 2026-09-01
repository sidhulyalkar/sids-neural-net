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
  applyAmbientBehaviorEvent,
  type FrontierAmbientBehaviorAggregate,
} from '../lib/frontier/ambientBehavior';
import {
  ReactionInferenceEngine,
  scoreReactionCues,
  type FrontierReactionFaceInput,
} from '../lib/frontier/reaction';
import { selectReactionTarget } from '../lib/frontier/reactionTarget';
import { reactionTrustAuthority, reactionTrustQuarantined } from '../lib/frontier/reactionTrust';
import type { FrontierBehaviorAggregate, FrontierItem } from '../lib/frontier/types';

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
    id: 'convergence-signal',
    title: 'A surprising visual computing technique',
    summary: 'A high quality creative technical signal.',
    url: 'https://github.com/example/convergence-signal',
    source: 'github.com',
    sourceLabel: 'GitHub',
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

function ambient(aggregate: FrontierBehaviorAggregate | undefined): FrontierAmbientBehaviorAggregate {
  assert.ok(aggregate);
  return aggregate as FrontierAmbientBehaviorAggregate;
}

test('reaction scoring requires active expression instead of neutral posture', () => {
  const baseline = { ...neutralExpressions };
  const neutral = scoreReactionCues(face({ stillness: 1, expressions: { ...baseline } }), baseline);
  const affinity = scoreReactionCues(face({ expressions: { ...baseline, smile: 0.82, eyeSquint: 0.35 } }), baseline);
  const surprise = scoreReactionCues(face({ expressions: { ...baseline, browRaise: 0.7, eyeWide: 0.82, jawOpen: 0.52 } }), baseline);
  const friction = scoreReactionCues(face({ expressions: { ...baseline, browFurrow: 0.8, mouthPress: 0.67 } }), baseline);

  assert.equal(neutral.interest, 0);
  assert.ok(affinity.affinity > affinity.surprise);
  assert.ok(surprise.surprise > surprise.affinity);
  assert.ok(friction.friction > friction.affinity);
});

test('reaction inference requires calibration, sustained evidence, and cooldown', () => {
  const engine = new ReactionInferenceEngine({
    calibrationMs: 10,
    minimumCalibrationSamples: 2,
    emaAlpha: 1,
    minConfidence: 0.6,
    minMargin: 0.1,
    minDurationMs: 50,
    minimumTargetDwellMs: 0,
    cooldownMs: 100,
    globalCooldownMs: 0,
  });
  const neutral = face();
  const smiling = face({ expressions: { ...neutralExpressions, smile: 0.9, eyeSquint: 0.45 } });

  assert.equal(engine.push(neutral, 'card-a', 0).phase, 'calibrating');
  assert.equal(engine.push(neutral, 'card-a', 10).phase, 'calibrating');
  assert.equal(engine.push(smiling, 'card-a', 20).reaction, undefined);
  assert.equal(engine.push(smiling, 'card-a', 80).reaction?.kind, 'affinity');
  assert.equal(engine.push(smiling, 'card-a', 90).reaction, undefined);
  assert.equal(engine.push(smiling, 'card-a', 190).reaction?.kind, 'affinity');
});

test('reaction targeting abstains on ambiguous or barely visible cards', () => {
  assert.equal(selectReactionTarget([
    { id: 'a', score: 0.72, visibleFraction: 0.8 },
    { id: 'b', score: 0.68, visibleFraction: 0.76 },
  ]), undefined);
  assert.equal(selectReactionTarget([{ id: 'a', score: 0.72, visibleFraction: 0.2 }]), undefined);
  assert.equal(selectReactionTarget([
    { id: 'a', score: 0.78, visibleFraction: 0.85 },
    { id: 'b', score: 0.55, visibleFraction: 0.5 },
  ]), 'a');
});

test('repeatedly contradicted reaction cues are quarantined at exactly zero authority', () => {
  const unreliable = { observed: 12, confirmed: 1, contradicted: 8, confidenceSum: 9 };
  const reliable = { observed: 12, confirmed: 8, contradicted: 1, confidenceSum: 9 };
  assert.equal(reactionTrustQuarantined(unreliable), true);
  assert.equal(reactionTrustAuthority(unreliable), 0);
  assert.equal(reactionTrustQuarantined(reliable), false);
  assert.ok(reactionTrustAuthority(reliable) > 0.85);
  assert.ok(reactionTrustAuthority(reliable) <= 1.15);
});

test('ambient affinity is weak evidence while explicit actions remain materially stronger', () => {
  const signal = item();
  const when = new Date('2026-08-30T11:30:00.000Z');
  let ambientOnly = createInitialBehaviorModel();
  let explicit = createInitialBehaviorModel();

  for (let index = 0; index < 5; index += 1) {
    ambientOnly = applyBehaviorEvent(ambientOnly, signal, { kind: 'impression' }, when);
    ambientOnly = applyAmbientBehaviorEvent(ambientOnly, signal, {
      kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 0.9, intensity: 0.7, durationMs: 1_400,
    }, when);
    explicit = applyBehaviorEvent(explicit, signal, { kind: 'impression' }, when);
  }
  explicit = applyBehaviorEvent(explicit, signal, { kind: 'positive' }, when);
  explicit = applyBehaviorEvent(explicit, signal, { kind: 'save' }, when);

  const ambientPreference = aggregatePreference(ambientOnly.topicStats['visual computing'], when);
  const explicitPreference = aggregatePreference(explicit.topicStats['visual computing'], when);
  assert.ok(ambientPreference.score > 0);
  assert.ok(ambientPreference.score < 0.2);
  assert.ok(explicitPreference.score > ambientPreference.score);
  assert.ok(explicitPreference.confidence > ambientPreference.confidence);
});

test('friction is retained diagnostically but has zero preference authority', () => {
  const signal = item({ tags: ['dense methods'] });
  const when = new Date('2026-08-30T12:00:00.000Z');
  let baseline = createInitialBehaviorModel();
  let friction = createInitialBehaviorModel();

  for (let index = 0; index < 8; index += 1) {
    baseline = applyBehaviorEvent(baseline, signal, { kind: 'impression' }, when);
    friction = applyBehaviorEvent(friction, signal, { kind: 'impression' }, when);
    friction = applyAmbientBehaviorEvent(friction, signal, {
      kind: 'ambient_reaction', ambientReaction: 'friction', confidence: 1, intensity: 1, durationMs: 2_000,
    }, when);
  }

  const aggregate = ambient(friction.topicStats['dense methods']);
  assert.ok((aggregate.ambientFriction ?? 0) > 0);
  assert.equal(aggregate.ambientEvidence, undefined);
  assert.deepEqual(
    aggregatePreference(aggregate, when),
    aggregatePreference(baseline.topicStats['dense methods'], when),
  );
});

test('ambient correction exactly debits passive evidence without changing explicit behavior or recency', () => {
  const signal = item({ tags: ['graphics', 'visual systems'] });
  const admitted = {
    ambientReaction: 'affinity' as const,
    confidence: 0.72,
    intensity: 0.61,
    durationMs: 1_450,
  };
  let model = createInitialBehaviorModel();
  model = applyBehaviorEvent(model, signal, { kind: 'impression' }, new Date('2026-08-30T12:00:00.000Z'));
  model = applyBehaviorEvent(model, signal, { kind: 'open' }, new Date('2026-08-30T12:00:30.000Z'));
  model = applyAmbientBehaviorEvent(model, signal, { kind: 'ambient_reaction', ...admitted }, new Date('2026-08-30T12:01:00.000Z'));

  const before = ambient(model.laneStats.creative_tech);
  const lastAt = before.lastAt;
  assert.ok((before.ambientEvidence ?? 0) > 0);
  model = applyAmbientBehaviorEvent(model, signal, { kind: 'ambient_retraction', ...admitted }, new Date('2026-08-30T12:02:00.000Z'));
  const corrected = ambient(model.laneStats.creative_tech);

  assert.equal(corrected.ambientEvidence, 0);
  assert.equal(corrected.ambientAffinity, 0);
  assert.equal(corrected.shown, 1);
  assert.equal(corrected.opened, 1);
  assert.equal(corrected.lastAt, lastAt);
});

test('ambient retraction remains authoritative when learning is disabled and cannot create phantom evidence', () => {
  const signal = item();
  const event = {
    ambientReaction: 'affinity' as const,
    confidence: 0.8,
    intensity: 0.7,
    durationMs: 1_500,
  };
  const untouched = applyAmbientBehaviorEvent(createInitialBehaviorModel(), signal, { kind: 'ambient_retraction', ...event });
  assert.deepEqual(untouched.laneStats, {});

  let model = applyAmbientBehaviorEvent(createInitialBehaviorModel(), signal, { kind: 'ambient_reaction', ...event });
  model = { ...model, implicitLearning: false };
  model = applyAmbientBehaviorEvent(model, signal, { kind: 'ambient_retraction', ...event });
  assert.equal(ambient(model.laneStats.creative_tech).ambientEvidence, 0);
});

test('ambient accounting canonicalizes duplicate topic tags before learning', () => {
  const signal = item({ tags: ['BCI', 'bci', ' BCI ', 'neural interfaces'] });
  const model = applyAmbientBehaviorEvent(createInitialBehaviorModel(), signal, {
    kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 0.8, intensity: 0.7, durationMs: 1_500,
  });
  assert.deepEqual(Object.keys(model.topicStats).sort(), ['bci', 'neural interfaces']);
});

test('current-session ambient evidence cannot reshuffle the frozen ranking snapshot', () => {
  const signal = item();
  const prior = new Date('2026-08-29T11:00:00.000Z');
  const session = new Date('2026-08-30T11:00:00.000Z');
  let model = createInitialBehaviorModel();
  for (let index = 0; index < 4; index += 1) {
    model = applyBehaviorEvent(model, signal, { kind: 'impression' }, prior);
    model = applyBehaviorEvent(model, signal, { kind: 'open' }, prior);
  }
  model = startBehaviorSession(model, session);
  const before = behavioralAdjustment(signal, model, session);
  model = applyAmbientBehaviorEvent(model, signal, {
    kind: 'ambient_reaction', ambientReaction: 'affinity', confidence: 1, intensity: 1, durationMs: 2_000,
  }, new Date('2026-08-30T11:05:00.000Z'));
  const after = behavioralAdjustment(signal, model, session);
  assert.equal(after, before);
});
