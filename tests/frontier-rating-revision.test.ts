import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBehaviorEvent, createInitialBehaviorModel, replaceInterestRatingBehavior } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { interestScoreReaction } from '../lib/frontier/interestRating';
import { applyReactionToProfile, replaceInterestRatingProfile } from '../lib/frontier/scoring';
import type { FrontierItem } from '../lib/frontier/types';

const item: FrontierItem = {
  id: 'research-benchmark',
  title: 'A new neural model benchmark',
  url: 'https://arxiv.org/abs/2610.00001',
  source: 'arxiv.org', sourceLabel: 'arXiv', sourceKind: 'arxiv',
  lane: 'neuro_frontier', publishedAt: '2026-10-30T12:00:00Z',
  summary: 'A new model benchmark.',
  tags: ['neuroscience', 'machine learning'],
  baseScore: .8, importance: .8, novelty: .8, quality: .8, momentum: .6,
};

test('changing an existing rating uses the difference in strength, not another vote', () => {
  const original = createInitialProfile();
  const onceHigh = applyReactionToProfile(original, item, interestScoreReaction(9));
  const correctedLow = replaceInterestRatingProfile(onceHigh, item, 9, 2);
  const directlyLow = applyReactionToProfile(original, item, interestScoreReaction(2));
  assert.equal(correctedLow.meaningfulInteractions, onceHigh.meaningfulInteractions,
    'A revision does not count as a second meaningful interaction');
  assert(Math.abs(correctedLow.laneAffinity[item.lane] - directlyLow.laneAffinity[item.lane]) < 1e-8);
  assert(Math.abs(correctedLow.topicAffinity.neuroscience - directlyLow.topicAffinity.neuroscience) < 1e-8);
  assert(Math.abs(correctedLow.sourceAffinity.arxiv - directlyLow.sourceAffinity.arxiv) < 1e-8);
  for (const key of Object.keys(directlyLow.interestPairs)) {
    assert(Math.abs((correctedLow.interestPairs[key] ?? 0) - directlyLow.interestPairs[key]) < 1e-8, key);
  }
  assert.deepEqual(replaceInterestRatingProfile(correctedLow, item, 2, 2), correctedLow);
  const roundTrip = replaceInterestRatingProfile(correctedLow, item, 2, 9);
  assert(Math.abs(roundTrip.laneAffinity[item.lane] - onceHigh.laneAffinity[item.lane]) < 1e-8);
});

test('rating correction reverses old behavior counters without erasing impressions', () => {
  const older = new Date('2026-10-30T08:00:00Z');
  const newer = new Date('2026-10-31T20:00:00Z');
  const firstSeen = applyBehaviorEvent(createInitialBehaviorModel(), item, { kind: 'impression' }, older);
  const high = applyBehaviorEvent(firstSeen, item, { kind: 'positive' }, older);
  const corrected = replaceInterestRatingBehavior(high, item, 9, 2, older.toISOString(), newer);
  assert.equal(corrected.laneStats.neuro_frontier.positive, 0);
  assert.equal(corrected.laneStats.neuro_frontier.negative, 1);
  assert.equal(corrected.laneStats.neuro_frontier.shown, 1);
  assert.equal(corrected.topicStats.neuroscience.positive, 0);
  assert.equal(corrected.topicStats.neuroscience.negative, 1);
  const restored = replaceInterestRatingBehavior(corrected, item, 2, 9, newer.toISOString(), newer);
  assert.equal(restored.laneStats.neuro_frontier.positive, 1);
  assert.equal(restored.laneStats.neuro_frontier.negative, 0);
  assert.deepEqual(replaceInterestRatingBehavior(restored, item, 9, 9), restored);
});

test('neutral ratings contribute no positive or negative counter on revision', () => {
  const at = new Date('2026-10-31T20:00:00Z');
  const withDown = applyBehaviorEvent(createInitialBehaviorModel(), item, { kind: 'negative' }, at);
  const neutral = replaceInterestRatingBehavior(withDown, item, 2, 5, at.toISOString(), at);
  assert.equal(neutral.laneStats.neuro_frontier.negative, 0);
  assert.equal(neutral.laneStats.neuro_frontier.positive, 0);
  const positive = replaceInterestRatingBehavior(neutral, item, 5, 8, at.toISOString(), at);
  assert.equal(positive.laneStats.neuro_frontier.positive, 1);
});
