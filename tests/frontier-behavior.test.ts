import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePreference,
  applyBehaviorEvent,
  behavioralAdjustment,
  createInitialBehaviorModel,
  endBehaviorSession,
  formatForItem,
  recordLayoutUse,
  startBehaviorSession,
  summarizeHabits,
  timeBucket,
} from '../lib/frontier/behavior';
import type { FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'behavior-signal',
    title: 'A new downhill mountain biking race run',
    summary: 'Professional racing, technique, and a standout video clip.',
    url: 'https://example.com/mtb',
    source: 'example.com',
    sourceLabel: 'MTB World',
    sourceKind: 'youtube',
    publishedAt: '2026-08-21T00:00:00.000Z',
    lane: 'sports',
    tags: ['active sport', 'mountain biking', 'downhill'],
    media: { type: 'youtube', url: 'abc123' },
    baseScore: 0.6,
    importance: 0.55,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.7,
    ...overrides,
  };
}

test('format and time context are derived from the actual signal and local clock', () => {
  assert.equal(formatForItem(item()), 'video');
  assert.equal(timeBucket(new Date('2026-08-21T19:30:00')), 'evening');
  assert.equal(timeBucket(new Date('2026-08-21T01:30:00')), 'late');
});

test('dwell, expansion, open, save, and positive feedback accumulate preference evidence', () => {
  const signal = item();
  const when = new Date('2026-08-21T19:30:00');
  let model = createInitialBehaviorModel();
  model = applyBehaviorEvent(model, signal, { kind: 'impression' }, when);
  model = applyBehaviorEvent(model, signal, { kind: 'dwell', dwellMs: 7_500 }, when);
  model = applyBehaviorEvent(model, signal, { kind: 'expand' }, when);
  model = applyBehaviorEvent(model, signal, { kind: 'open' }, when);
  model = applyBehaviorEvent(model, signal, { kind: 'save' }, when);
  model = applyBehaviorEvent(model, signal, { kind: 'positive' }, when);

  assert.equal(model.laneStats.sports.shown, 1);
  assert.equal(model.topicStats['mountain biking'].opened, 1);
  assert.equal(model.formatStats.video.saved, 1);
  assert.equal(model.contextStats['evening:sports'].positive, 1);
  assert.ok(aggregatePreference(model.laneStats.sports).score > 0.5);

  // Live evidence is inspectable immediately but does not move the current feed.
  assert.equal(behavioralAdjustment(signal, model, when), 0);
  model = startBehaviorSession(model, new Date('2026-08-22T19:30:00'));
  assert.ok(behavioralAdjustment(signal, model, new Date('2026-08-22T19:30:00')) > 0);
});

test('ranking snapshot remains frozen while current-session behavior changes', () => {
  const signal = item();
  const firstVisit = new Date('2026-08-21T18:00:00');
  let model = createInitialBehaviorModel();
  model = applyBehaviorEvent(model, signal, { kind: 'impression' }, firstVisit);
  model = applyBehaviorEvent(model, signal, { kind: 'open' }, firstVisit);
  model = applyBehaviorEvent(model, signal, { kind: 'save' }, firstVisit);
  model = startBehaviorSession(model, new Date('2026-08-22T18:00:00'));

  const before = behavioralAdjustment(signal, model, new Date('2026-08-22T18:00:00'));
  model = applyBehaviorEvent(model, signal, { kind: 'positive' }, new Date('2026-08-22T18:02:00'));
  model = applyBehaviorEvent(model, signal, { kind: 'open' }, new Date('2026-08-22T18:03:00'));
  const after = behavioralAdjustment(signal, model, new Date('2026-08-22T18:04:00'));

  assert.equal(after, before);
});

test('mere exposure is weak evidence and does not immediately punish a topic', () => {
  const signal = item();
  let model = createInitialBehaviorModel();
  for (let index = 0; index < 8; index += 1) {
    model = applyBehaviorEvent(model, signal, { kind: 'impression' }, new Date(`2026-08-2${index % 2 + 1}T12:00:00`));
  }
  const preference = aggregatePreference(model.laneStats.sports);
  assert.ok(preference.score >= 0);
});

test('implicit learning can be paused without changing accumulated behavior', () => {
  const signal = item();
  const base = createInitialBehaviorModel();
  const paused = { ...base, implicitLearning: false };
  const next = applyBehaviorEvent(paused, signal, { kind: 'open' }, new Date('2026-08-21T18:00:00'));
  assert.deepEqual(next, paused);
});

test('first session still counts if an earlier UI event touched last-active time', () => {
  let model = createInitialBehaviorModel();
  model = recordLayoutUse(model, 'desk');
  model = startBehaviorSession(model, new Date());
  assert.equal(model.sessions, 1);
  assert.ok(model.sessionStartedAt);
});

test('session and layout behavior produce inspectable habit summaries', () => {
  let model = createInitialBehaviorModel();
  model = startBehaviorSession(model, new Date('2026-08-21T18:00:00'));
  model = recordLayoutUse(model, 'feed');
  model = recordLayoutUse(model, 'feed');
  model = recordLayoutUse(model, 'feed');
  model = endBehaviorSession(model, new Date('2026-08-21T18:12:00'));
  model = startBehaviorSession(model, new Date('2026-08-22T18:00:00'));
  model = endBehaviorSession(model, new Date('2026-08-22T18:08:00'));

  assert.equal(model.sessions, 2);
  assert.equal(model.layoutUses.feed, 3);
  const insights = summarizeHabits(model);
  assert.ok(insights.some((insight) => insight.label === 'Reading mode'));
  assert.ok(insights.some((insight) => insight.label === 'Session shape'));
});
