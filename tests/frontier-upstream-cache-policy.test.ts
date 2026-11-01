import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierHackerNewsSince, frontierUpstreamTtlSeconds } from '../lib/frontier/upstreamCachePolicy';

test('public source TTLs differ by source and avoid repeated high-frequency fetching', () => {
  assert.equal(frontierUpstreamTtlSeconds('arxiv', ''), 900);
  assert.equal(frontierUpstreamTtlSeconds('huggingface', ''), 600);
  assert.equal(frontierUpstreamTtlSeconds('paperswithcode', ''), 1800);
  assert.equal(frontierUpstreamTtlSeconds('hackernews', ''), 300);
  assert.equal(frontierUpstreamTtlSeconds('rss', ''), 900);
});

test('never shared-cache private queries or credentialed source requests', () => {
  for (const source of ['arxiv', 'huggingface', 'github', 'paperswithcode', 'hackernews', 'rss'] as const) {
    assert.equal(frontierUpstreamTtlSeconds(source, 'my private research'), 0);
    assert.equal(frontierUpstreamTtlSeconds(source, '', true), 0);
    assert.equal(frontierUpstreamTtlSeconds(source, 'topic', true), 0);
  }
});

test('moving news query uses five-minute buckets to allow stable cache keys', () => {
  const start = Date.parse('2026-11-01T12:01:00Z');
  const bucket = frontierHackerNewsSince(start);
  assert.equal(frontierHackerNewsSince(start + 60_000), bucket);
  assert.equal(frontierHackerNewsSince(start + 4 * 60_000), bucket + 300);
  assert(Number.isInteger(bucket));
});
