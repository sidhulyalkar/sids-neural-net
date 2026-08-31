import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBehaviorEvent, createInitialBehaviorModel } from '../lib/frontier/behavior';
import type { FrontierBehaviorModel, FrontierItem } from '../lib/frontier/types';

const signal: FrontierItem = {
  id: 'ambient-retraction-signal',
  title: 'A visual systems signal',
  summary: 'Deterministic fixture for reversible ambient evidence.',
  url: 'https://example.com/ambient-retraction',
  source: 'example.com',
  sourceLabel: 'Example',
  sourceKind: 'github',
  publishedAt: '2026-08-30T12:00:00.000Z',
  lane: 'creative_tech',
  tags: ['graphics', 'visual systems'],
  baseScore: 0.6,
  importance: 0.6,
  novelty: 0.7,
  quality: 0.8,
  momentum: 0.5,
};

const admitted = {
  ambientReaction: 'affinity' as const,
  confidence: 0.72,
  intensity: 0.61,
  durationMs: 1_450,
};

function admit(model: FrontierBehaviorModel): FrontierBehaviorModel {
  return applyBehaviorEvent(model, signal, { kind: 'ambient_reaction', ...admitted }, new Date('2026-08-30T12:01:00.000Z'));
}

function retract(model: FrontierBehaviorModel): FrontierBehaviorModel {
  return applyBehaviorEvent(model, signal, { kind: 'ambient_retraction', ...admitted }, new Date('2026-08-30T12:02:00.000Z'));
}

test('contradicted ambient evidence is exactly debited without touching explicit behavior', () => {
  let model = createInitialBehaviorModel();
  model = applyBehaviorEvent(model, signal, { kind: 'impression' }, new Date('2026-08-30T12:00:00.000Z'));
  model = applyBehaviorEvent(model, signal, { kind: 'open' }, new Date('2026-08-30T12:00:30.000Z'));
  model = admit(model);

  const beforeCorrection = model.laneStats.creative_tech;
  assert.ok((beforeCorrection.ambientEvidence ?? 0) > 0);
  assert.ok((beforeCorrection.ambientAffinity ?? 0) > 0);
  assert.equal(beforeCorrection.shown, 1);
  assert.equal(beforeCorrection.opened, 1);
  const ambientLastAt = beforeCorrection.lastAt;

  model = retract(model);
  const corrected = model.laneStats.creative_tech;
  assert.equal(corrected.ambientEvidence, 0);
  assert.equal(corrected.ambientAffinity, 0);
  assert.equal(corrected.shown, 1);
  assert.equal(corrected.opened, 1);
  assert.equal(corrected.lastAt, ambientLastAt, 'correction must not rejuvenate aggregate recency');

  assert.equal(model.topicStats.graphics.ambientEvidence, 0);
  assert.equal(model.topicStats['visual systems'].ambientEvidence, 0);
  assert.equal(model.sourceStats.github.ambientEvidence, 0);
  assert.equal(model.sourceStats.example.ambientEvidence, 0);
  assert.equal(model.formatStats.code.ambientEvidence, 0);
});

test('ambient correction remains authoritative after implicit learning is disabled', () => {
  let model = admit(createInitialBehaviorModel());
  model = { ...model, implicitLearning: false };
  model = retract(model);
  assert.equal(model.laneStats.creative_tech.ambientEvidence, 0);
  assert.equal(model.laneStats.creative_tech.ambientAffinity, 0);
});

test('ambient retraction cannot create phantom aggregates or negative evidence', () => {
  const untouched = retract(createInitialBehaviorModel());
  assert.deepEqual(untouched.laneStats, {});
  assert.deepEqual(untouched.topicStats, {});

  let model = admit(createInitialBehaviorModel());
  model = retract(model);
  model = retract(model);
  assert.equal(model.laneStats.creative_tech.ambientEvidence, 0);
  assert.equal(model.laneStats.creative_tech.ambientAffinity, 0);
});
