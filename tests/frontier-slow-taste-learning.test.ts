import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { applyReactionToProfile, personalizedScore } from '../lib/frontier/scoring';
import {
  applyImplicitTasteSignal,
  canonicalTastePair,
  pairAffinityForItem,
  tastePairsForItem,
} from '../lib/frontier/tasteLearning';
import type { FrontierItem } from '../lib/frontier/types';

function signal(id = 'nfl-viz', tags = ['nfl', 'sports analytics', 'player tracking']): FrontierItem {
  return {
    id,
    title: 'NFL tracking visualization and EPA analysis',
    summary: 'A sports-data visualization combining player tracking and EPA.',
    url: `https://www.pro-football-reference.com/${id}`,
    source: 'pro-football-reference.com',
    sourceLabel: 'Pro Football Reference',
    sourceKind: 'rss',
    publishedAt: '2026-08-24T04:00:00.000Z',
    lane: 'sports',
    tags,
    baseScore: 0.74,
    importance: 0.65,
    novelty: 0.62,
    quality: 0.8,
    momentum: 0.58,
  };
}

test('brief incidental dwell cannot mutate durable pair memory', () => {
  const profile = createInitialProfile();
  const next = applyImplicitTasteSignal(profile, signal(), 'dwell', 2_000);
  assert.strictEqual(next, profile);
});

test('meaningful attention learns only a small co-interest nudge, not duplicate topic or lane evidence', () => {
  const profile = createInitialProfile();
  const item = signal();
  const next = applyImplicitTasteSignal(profile, item, 'dwell', 30_000);
  const pair = canonicalTastePair('nfl', 'sports analytics');
  assert.ok(next.interestPairs[pair] > 0);
  assert.ok(next.interestPairs[pair] < 0.02);
  assert.equal(next.topicAffinity.nfl, profile.topicAffinity.nfl);
  assert.equal(next.laneAffinity.sports, profile.laneAffinity.sports);
  assert.deepEqual(next.sourceAffinity, profile.sourceAffinity);
});

test('provenance labels and domain-like tags never become learned co-interests', () => {
  const item = signal('provenance', [
    'nfl',
    'sports analytics',
    'pro-football-reference.com',
    'Pro Football Reference',
    'example.co.uk/path',
  ]);
  const pairs = tastePairsForItem(item);
  assert.ok(pairs.includes(canonicalTastePair('nfl', 'sports analytics')));
  assert.equal(pairs.some((pair) => pair.includes('pro-football-reference.com')), false);
  assert.equal(pairs.some((pair) => pair.includes('pro football reference')), false);
  assert.equal(pairs.some((pair) => pair.includes('example.co.uk')), false);
});

test('open and save strengthen pair evidence more than dwell while explicit negative feedback can reverse it', () => {
  const profile = createInitialProfile();
  const item = signal();
  const pair = canonicalTastePair('nfl', 'sports analytics');
  const dwell = applyImplicitTasteSignal(profile, item, 'dwell', 30_000);
  const opened = applyImplicitTasteSignal(profile, item, 'open');
  const saved = applyImplicitTasteSignal(profile, item, 'save');
  assert.ok(opened.interestPairs[pair] > dwell.interestPairs[pair]);
  assert.ok(saved.interestPairs[pair] > opened.interestPairs[pair]);

  const afterAttention = applyImplicitTasteSignal(profile, item, 'dwell', 60_000);
  const explicitlyDown = applyReactionToProfile(afterAttention, item, 'down');
  assert.ok(explicitlyDown.interestPairs[pair] < 0);
  assert.ok(explicitlyDown.topicAffinity.nfl < profile.topicAffinity.nfl);
});

test('pair memory recognizes repeated intersections without becoming recommendation authority by itself', () => {
  const profile = createInitialProfile();
  const item = signal('nfl-viz-pair', ['nfl', 'sports analytics', 'scientific visualization', 'player tracking']);
  const learned = applyImplicitTasteSignal(
    applyImplicitTasteSignal(profile, item, 'open'),
    item,
    'save',
  );
  assert.ok(pairAffinityForItem(item, learned) > 0);

  const unrelated = signal('unrelated', ['neuroscience', 'datajoint', 'scientific software']);
  assert.equal(pairAffinityForItem(unrelated, learned), 0);

  const now = new Date('2026-08-24T05:00:00.000Z');
  assert.ok(personalizedScore(item, learned, undefined, now) > personalizedScore(item, profile, undefined, now));
});

test('pair memory remains bounded under many distinct saved combinations', () => {
  let profile = createInitialProfile();
  for (let index = 0; index < 120; index += 1) {
    const tags = Array.from({ length: 6 }, (_, tagIndex) => `topic-${index}-${tagIndex}`);
    profile = applyImplicitTasteSignal(profile, signal(`many-${index}`, tags), 'save');
  }
  assert.ok(Object.keys(profile.interestPairs).length <= 256);
});
