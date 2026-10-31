import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRONTIER_MAX_LATEST_ITEMS,
  FRONTIER_RECHECK_AFTER_MS,
  frontierHasNewStories,
  frontierHasUsableRecentFeed,
  frontierRecentItems,
  frontierShouldCheckLatest,
} from '../lib/frontier/liveFeedPolicy';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

const now = Date.parse('2026-10-31T20:00:00.000Z');
const item = (id: string, date = now, url = 'https://github.com/allenai/olmo'): FrontierItem => ({
  id,
  title: 'Reported primary-source research ' + id,
  summary: 'Research overview.',
  url,
  source: 'github.com',
  sourceLabel: 'GitHub',
  sourceKind: 'github',
  publishedAt: new Date(date).toISOString(),
  lane: 'ai_frontier',
  tags: ['research'],
  baseScore: .7, importance: .7, novelty: .8, quality: .8, momentum: .5,
});
const feed = (items: FrontierItem[]): FrontierFeedResponse => ({
  generatedAt: new Date(now).toISOString(),
  items,
  sources: [],
});

test('freshness check is based on generation time, not how recently the page loaded', () => {
  assert.equal(frontierShouldCheckLatest(new Date(now).toISOString(), now), false);
  assert.equal(frontierShouldCheckLatest(new Date(now - FRONTIER_RECHECK_AFTER_MS).toISOString(), now), false);
  assert.equal(frontierShouldCheckLatest(new Date(now - FRONTIER_RECHECK_AFTER_MS - 1).toISOString(), now), true);
  assert.equal(frontierShouldCheckLatest('broken', now), true);
  assert.equal(frontierShouldCheckLatest(new Date(now + 300_000).toISOString(), now), true);
});

test('recent cache ignores out-of-window rows, future lies and duplicate canonical links', () => {
  const accepted = frontierRecentItems([
    item('a', now, 'https://github.com/allenai/olmo?utm_source=feed'),
    item('b', now, 'https://github.com/allenai/olmo'),
    item('c', now - 11 * 24 * 60 * 60_000, 'https://github.com/old/old'),
    item('d', now + 13 * 60 * 60_000, 'https://github.com/future/future'),
    item('e', now, 'https://github.com/new/valid'),
  ], now);
  assert.deepEqual(accepted.map((entry) => entry.id), ['a', 'e']);
});

test('cache does not store empty, purely old or implausibly sparse discovery', () => {
  assert.equal(frontierHasUsableRecentFeed(feed([]), now), false);
  assert.equal(frontierHasUsableRecentFeed(feed(Array.from({ length: 8 }, (_, index) =>
    item('old-' + index, now - 9 * 24 * 60 * 60_000, 'https://github.com/test/old-' + index))), now), false);
  const valid = feed(Array.from({ length: 9 }, (_, index) =>
    item('recent-' + index, now - index * 60 * 60_000, 'https://github.com/test/recent-' + index)));
  assert.equal(frontierHasUsableRecentFeed(valid, now), true);
});

test('oversized editions are capped and latest notification needs a genuinely new id', () => {
  const rows = Array.from({ length: FRONTIER_MAX_LATEST_ITEMS + 25 }, (_, index) =>
    item('item-' + index, now, 'https://github.com/test/repo-' + index));
  assert.equal(frontierRecentItems(rows, now).length, FRONTIER_MAX_LATEST_ITEMS);
  assert.equal(frontierHasNewStories(['a', 'b'], ['b', 'a']), false);
  assert.equal(frontierHasNewStories(['a', 'b'], ['b', 'c']), true);
});
