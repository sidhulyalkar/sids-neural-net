import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import {
  applyReactionToProfile,
  isDueForResurface,
  personalizedScore,
  rankFrontierItems,
  selectDailyRun,
} from '../lib/frontier/scoring';
import { parseFrontierRss } from '../lib/frontier/sources';
import type { FrontierHistoryEntry, FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'signal-1',
    title: 'A useful machine learning analysis method',
    summary: 'Technical evidence and implementation details.',
    url: 'https://example.com/signal-1',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'openalex',
    publishedAt: new Date().toISOString(),
    lane: 'ml_data',
    tags: ['machine learning', 'data analysis'],
    baseScore: 0.7,
    importance: 0.65,
    novelty: 0.58,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

function history(signal: FrontierItem, lastSeenAt: string): FrontierHistoryEntry {
  return {
    item: signal,
    firstSeenAt: lastSeenAt,
    lastSeenAt,
    impressions: 1,
    resurfacedCount: 0,
    rewarded: false,
  };
}

test('positive feedback strengthens the corresponding lane and topic', () => {
  const profile = createInitialProfile();
  const signal = item();
  const next = applyReactionToProfile(profile, signal, 'love');
  assert.ok(next.laneAffinity.ml_data > profile.laneAffinity.ml_data);
  assert.ok(next.topicAffinity['machine learning'] > 0);
});

test('already-known feedback advances knowledge without penalizing topic preference', () => {
  const profile = createInitialProfile();
  const signal = item();
  const next = applyReactionToProfile(profile, signal, 'known');
  assert.equal(next.laneAffinity.ml_data, profile.laneAffinity.ml_data);
  assert.equal(next.topicAffinity['machine learning'], undefined);
  assert.ok(next.knownTopics['machine learning'] > 0);
});

test('hidden items are removed from personalized ranking', () => {
  const signal = item();
  const hiddenHistory: Record<string, FrontierHistoryEntry> = {
    [signal.id]: { ...history(signal, new Date().toISOString()), reaction: 'hide' },
  };
  assert.deepEqual(rankFrontierItems([signal], createInitialProfile(), hiddenHistory), []);
});

test('unresolved valuable items become due for a second chance after one day', () => {
  const now = new Date('2026-08-20T18:00:00.000Z');
  const signal = item({ publishedAt: '2026-08-18T18:00:00.000Z' });
  const entry = history(signal, '2026-08-19T12:00:00.000Z');
  assert.equal(isDueForResurface(entry, now), true);
  assert.ok(personalizedScore(signal, createInitialProfile(), entry, now) > 0);
});

test('daily run reserves soccer and ML/data when those signals exist', () => {
  const signals = [
    item({ id: 'important', lane: 'must_know', importance: 0.95, title: 'Major release' }),
    item({ id: 'pl', lane: 'premier_league', title: 'Premier League tactical shift', tags: ['premier league', 'tactics'] }),
    item({ id: 'ml', lane: 'ml_data', title: 'New data analysis method' }),
    item({ id: 'neuro', lane: 'neuro_frontier', title: 'Neural decoding result', tags: ['neural decoding'] }),
    item({ id: 'wild', lane: 'wildcards', title: 'Unexpected adjacent idea', novelty: 0.9, tags: ['unexpected'] }),
  ];
  const ranked = rankFrontierItems(signals, createInitialProfile(), {});
  const run = selectDailyRun(ranked, {}, 5);
  assert.ok(run.some((signal) => signal.lane === 'premier_league'));
  assert.ok(run.some((signal) => signal.lane === 'ml_data'));
});

test('rss parser retains publisher image media and classifies Premier League signal', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title>Premier League teams rethink pressing after opening weekend</title>
    <link>https://example.com/football</link>
    <description><![CDATA[An analysis of pressing, xG and buildup in the Premier League.]]></description>
    <pubDate>Thu, 20 Aug 2026 10:00:00 GMT</pubDate>
    <media:content url="https://example.com/image.jpg" medium="image" />
  </item></channel></rss>`;
  const parsed = parseFrontierRss(xml, 'Football Lab');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lane, 'premier_league');
  assert.equal(parsed[0].media?.url, 'https://example.com/image.jpg');
});
