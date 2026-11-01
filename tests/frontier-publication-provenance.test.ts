import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_UNKNOWN_PUBLICATION_DATE,
  parseGithubTrending,
  parseHackerNews,
  parseHuggingFaceDailyPapers,
  parseRss,
} from '../lib/frontier/sourceIngestor';
import { isPlausibleFrontierCandidate } from '../lib/frontier/aggregate';

test('undated feed entry cannot masquerade as newly published editorial material', () => {
  const rss = parseRss(
    '<rss><channel><title>Research Feed</title><item><title>Novel model</title>' +
    '<link>https://example.com/novel-model</link><description>Undated source</description>' +
    '</item></channel></rss>',
    'https://example.com/feed',
  );
  assert.equal(rss.length, 1);
  assert.equal(rss[0].publishedAt, FRONTIER_UNKNOWN_PUBLICATION_DATE);
  assert.equal(isPlausibleFrontierCandidate(rss[0]), false);
  assert.doesNotMatch(rss[0].why ?? '', /^Fresh /);
});

test('undated repo, HN story and HF daily paper never inherit fetch time', () => {
  const github = parseGithubTrending({ items: [{
    id: 42, full_name: 'example/repo', html_url: 'https://github.com/example/repo',
  }]});
  const hn = parseHackerNews({ hits: [{
    objectID: '42', title: 'Experimental benchmark', url: 'https://example.com/test',
  }]});
  const hf = parseHuggingFaceDailyPapers([{
    paper: { id: '2601.00001', title: 'Research with missing publish date' },
  }]);
  for (const group of [github, hn, hf]) {
    assert.equal(group.length, 1);
    assert.equal(group[0].publishedAt, FRONTIER_UNKNOWN_PUBLICATION_DATE);
    assert.equal(isPlausibleFrontierCandidate(group[0]), false);
  }
});

test('valid explicit publication date is preserved and remains eligible', () => {
  const rss = parseRss(
    '<rss><channel><title>Research Feed</title><item><title>Published experiment</title>' +
    '<link>https://example.com/experiment</link><pubDate>Sat, 31 Oct 2026 18:00:00 GMT</pubDate>' +
    '</item></channel></rss>',
    'https://example.com/feed',
  );
  assert.equal(rss.length, 1);
  assert.equal(rss[0].publishedAt, '2026-10-31T18:00:00.000Z');
  assert.equal(isPlausibleFrontierCandidate(rss[0], Date.parse('2026-11-01T19:00:00Z')), true);
});
