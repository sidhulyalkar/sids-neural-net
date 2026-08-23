import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlausibleFrontierCandidate } from '../lib/frontier/aggregate';
import {
  dedupeIngestedItems,
  parseArxivAtom,
  parseHackerNews,
  parseHuggingFaceDailyPapers,
  parseRss,
} from '../lib/frontier/sourceIngestor';
import {
  predictPointerIntersection,
  predictViewportIntersection,
} from '../lib/frontier/media/streamPrefetcher';
import type { FrontierItem } from '../lib/frontier/types';

function candidate(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'candidate',
    title: 'Relevant source-backed signal',
    summary: 'A source-backed candidate used for feed integrity tests.',
    url: 'https://example.com/signal',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'wildcards',
    tags: ['test'],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

test('arXiv Atom entries normalize into typed FRONTIER papers', () => {
  const xml = `<?xml version="1.0"?><feed>
    <entry>
      <id>http://arxiv.org/abs/2608.12345v1</id>
      <updated>2026-08-20T15:00:00Z</updated>
      <published>2026-08-20T15:00:00Z</published>
      <title>Mechanistic decoding of neural representations</title>
      <summary>We introduce a robust representation analysis method.</summary>
      <author><name>Ada Researcher</name></author>
      <category term="cs.LG" />
      <link href="https://arxiv.org/abs/2608.12345" rel="alternate" />
    </entry>
  </feed>`;
  const items = parseArxivAtom(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceKind, 'arxiv');
  assert.match(items[0].title, /Mechanistic decoding/);
  assert.deepEqual(items[0].authors, ['Ada Researcher']);
  assert.ok(items[0].tags.includes('cs.LG'));
});

test('Hugging Face Daily Papers normalize momentum and metadata', () => {
  const items = parseHuggingFaceDailyPapers([{
    paper: {
      id: '2608.01234',
      title: 'Tiny multimodal agents',
      summary: 'A small agent benchmark.',
      publishedAt: '2026-08-20T12:00:00Z',
      upvotes: 250,
      authors: [{ name: 'A' }, { name: 'B' }],
      ai_keywords: ['agents', 'multimodal'],
    },
  }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceKind, 'huggingface');
  assert.equal(items[0].authors?.length, 2);
  assert.ok(items[0].momentum > 0.5);
  assert.ok(items[0].tags.includes('agents'));
});

test('Hacker News and RSS tolerate missing optional fields without poisoning the feed', () => {
  const hn = parseHackerNews({ hits: [{ objectID: '1', title: 'WebGPU feed engine', points: 88, num_comments: 14 }] });
  assert.equal(hn.length, 1);
  assert.equal(hn[0].url, 'https://news.ycombinator.com/item?id=1');

  const rss = parseRss(`
    <rss><channel><title>Signal Wire</title>
      <item>
        <title><![CDATA[Climbing finals &amp; analysis]]></title>
        <link>https://example.com/post?utm_source=x</link>
        <description><![CDATA[<p>A concise final recap.</p>]]></description>
        <pubDate>Thu, 20 Aug 2026 10:00:00 GMT</pubDate>
        <category>climbing</category>
      </item>
      <item><title>Malformed missing link</title></item>
    </channel></rss>
  `, 'https://example.com/feed.xml');
  assert.equal(rss.length, 1);
  assert.equal(rss[0].sourceKind, 'rss');
  assert.match(rss[0].title, /Climbing finals/);
  assert.equal(rss[0].url, 'https://example.com/post');
});

test('ingestion dedupe collapses canonical URL and title duplicates', () => {
  const base = parseHackerNews({ hits: [
    { objectID: '1', title: 'A new neural benchmark', url: 'https://example.com/a?utm_source=hn' },
    { objectID: '2', title: 'A new neural benchmark', url: 'https://mirror.example/a' },
    { objectID: '3', title: 'Different title', url: 'https://example.com/a?ref=other' },
  ] });
  assert.equal(dedupeIngestedItems(base).length, 1);
});

test('integrated candidate integrity rejects malformed and implausibly future source data', () => {
  const now = Date.parse('2026-08-22T20:00:00.000Z');
  assert.equal(isPlausibleFrontierCandidate(candidate(), now), true);
  assert.equal(isPlausibleFrontierCandidate(candidate({ title: '   ' }), now), false);
  assert.equal(isPlausibleFrontierCandidate(candidate({ url: 'javascript:alert(1)' }), now), false);
  assert.equal(isPlausibleFrontierCandidate(candidate({ url: 'not a url' }), now), false);
  assert.equal(isPlausibleFrontierCandidate(candidate({ publishedAt: 'not-a-date' }), now), false);
  assert.equal(isPlausibleFrontierCandidate(candidate({ publishedAt: '2026-08-24T12:00:00.000Z' }), now), false);
});

test('integrated candidate integrity allows bounded publication clock skew', () => {
  const now = Date.parse('2026-08-22T20:00:00.000Z');
  assert.equal(
    isPlausibleFrontierCandidate(candidate({ publishedAt: '2026-08-23T06:00:00.000Z' }), now),
    true,
  );
});

test('300ms scroll prediction catches an item moving into the viewport', () => {
  const predicted = predictViewportIntersection(
    { top: 1000, bottom: 1300 },
    1.2,
    700,
    300,
    0
  );
  assert.equal(predicted, true);
});

test('300ms pointer trajectory catches a target ahead of cursor motion', () => {
  const predicted = predictPointerIntersection(
    { left: 400, right: 600, top: 300, bottom: 500 },
    { x: 100, y: 350, vx: 1.1, vy: 0 },
    300,
    0
  );
  assert.equal(predicted, true);
});
