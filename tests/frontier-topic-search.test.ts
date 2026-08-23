import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTopicSearchFocus, normalizeTopicSearch, topicSearchScore } from '../lib/frontier/topicSearch';
import type { FrontierItem } from '../lib/frontier/types';

function item(title: string, summary = '', tags: string[] = []): FrontierItem {
  return {
    id: title,
    title,
    summary,
    url: 'https://example.com',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-21T12:00:00.000Z',
    lane: 'ml_data',
    tags,
    baseScore: 0.5,
    importance: 0.5,
    novelty: 0.5,
    quality: 0.5,
    momentum: 0.5,
  };
}

test('topic search input is bounded and whitespace-normalized', () => {
  assert.equal(normalizeTopicSearch('  neural   decoding\n papers  '), 'neural decoding papers');
  assert.ok(normalizeTopicSearch('x'.repeat(200)).length <= 96);
});

test('explicit search leads the live discovery focus without duplicating adaptive topics', () => {
  const focus = buildTopicSearchFocus('Mountain Biking', ['neuroai', 'mountain biking', 'chelsea'], 4);
  assert.deepEqual(focus, ['mountain biking', 'neuroai', 'chelsea']);
});

test('search relevance strongly favors title and tag matches', () => {
  const exact = item('New neural decoding benchmark', 'A model comparison.', ['brain decoding']);
  const weak = item('General machine learning roundup', 'Mentions neural decoding once.', []);
  const none = item('Premier League weekend', 'Football analysis.', ['soccer']);
  assert.ok(topicSearchScore(exact, 'neural decoding') > topicSearchScore(weak, 'neural decoding'));
  assert.equal(topicSearchScore(none, 'neural decoding'), 0);
});
