import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregatePreference, applyBehaviorEvent, createInitialBehaviorModel } from '../lib/frontier/behavior';
import type { FrontierItem } from '../lib/frontier/types';

const signal: FrontierItem = {
  id: 'friction-diagnostic-only',
  title: 'A dense technical signal',
  summary: 'Used to prove facial tension cannot gain recommendation authority.',
  url: 'https://example.com/friction',
  source: 'example.com',
  sourceLabel: 'Example',
  sourceKind: 'rss',
  publishedAt: '2026-08-30T12:00:00.000Z',
  lane: 'methods',
  tags: ['dense methods'],
  baseScore: 0.5,
  importance: 0.6,
  novelty: 0.5,
  quality: 0.7,
  momentum: 0.4,
};

test('friction is retained for diagnostics but excluded from preference evidence and confidence', () => {
  const when = new Date('2026-08-30T12:00:00.000Z');
  let baseline = createInitialBehaviorModel();
  let friction = createInitialBehaviorModel();

  for (let index = 0; index < 8; index += 1) {
    baseline = applyBehaviorEvent(baseline, signal, { kind: 'impression' }, when);
    friction = applyBehaviorEvent(friction, signal, { kind: 'impression' }, when);
    friction = applyBehaviorEvent(friction, signal, {
      kind: 'ambient_reaction',
      ambientReaction: 'friction',
      confidence: 1,
      intensity: 1,
      durationMs: 2_000,
    }, when);
  }

  const aggregate = friction.topicStats['dense methods'];
  assert.ok((aggregate.ambientFriction ?? 0) > 0);
  assert.equal(aggregate.ambientEvidence, undefined);

  const baselinePreference = aggregatePreference(baseline.topicStats['dense methods'], when);
  const frictionPreference = aggregatePreference(aggregate, when);
  assert.deepEqual(frictionPreference, baselinePreference);
});
