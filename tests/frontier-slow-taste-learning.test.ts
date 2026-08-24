import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { applyReactionToProfile, personalizedScore } from '../lib/frontier/scoring';
import {
  applyImplicitTasteSignal,
  canonicalTastePair,
  pairAffinityForItem,
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

test('brief incidental dwell cannot mutate durable taste', () => {
  const profile = createInitialProfile();
  const next = applyImplicitTasteSignal(profile, signal(), 'dwell', 2_000);
  assert.strictEqual(next, profile);
});

test('meaningful attention produces only a small bounded durable nudge', () => {
  const profile = createInitialProfile();
  const item = signal();
  const before = profile.topicAffinity.nfl;
  const next = applyImplicitTasteSignal(profile, item, 'dwell', 30_000);
  assert.ok(next.topicAffinity.nfl > before);
  assert.ok(next.topicAffinity.nfl - before < 0.03);
  assert.ok(next.laneAffinity.sports > profile.laneAffinity.sports);
  assert.ok(next.sourceAffinity.rss > (profile.sourceAffinity.rss ?? 0));
  assert.ok(next.interestPairs[canonicalTastePair('nfl', 'sports analytics')] > 0);
});

test('open and save are stronger implicit evidence than dwell but remain weaker than explicit feedback', () => {
  const profile = createInitialProfile();
  const item = signal();
  const dwell = applyImplicitTasteSignal(profile, item, 'dwell', 30_000);
  const opened = applyImplicitTasteSignal(profile, item, 'open');
  const saved = applyImplicitTasteSignal(profile, item, 'save');
  assert.ok(opened.topicAffinity.nfl - profile.topicAffinity.nfl > dwell.topicAffinity.nfl - profile.topicAffinity.nfl);
  assert.ok(saved.topicAffinity.nfl - profile.topicAffinity.nfl > opened.topicAffinity.nfl - profile.topicAffinity.nfl);

  const afterAttention = applyImplicitTasteSignal(profile, item, 'dwell', 60_000);
  const explicitlyDown = applyReactionToProfile(afterAttention, item, 'down');
  assert.ok(explicitlyDown.topicAffinity.nfl < profile.topicAffinity.nfl);
  assert.ok(explicitlyDown.laneAffinity.sports < afterAttention.laneAffinity.sports);
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
