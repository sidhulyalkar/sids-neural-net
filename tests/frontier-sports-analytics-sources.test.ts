import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  parseSportsAnalyticsNewsRss,
  sportsAnalyticsQueries,
} from '../lib/frontier/sportsAnalyticsSources';

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>Superflex draft values shift after target-share and route-participation update</title>
    <link>https://news.google.com/rss/articles/example-fantasy</link>
    <guid>https://news.google.com/rss/articles/example-fantasy</guid>
    <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
    <description>New ADP and usage analysis for 2QB fantasy football formats.</description>
    <source url="https://www.fantasypros.com/">FantasyPros</source>
  </item>
</channel></rss>`;

test('sports analytics radar always pins NFL, fantasy, and visualization searches', () => {
  const queries = sportsAnalyticsQueries();
  assert.equal(queries.length, 4);
  assert.equal(queries[0].id, 'nfl-analytics');
  assert.equal(queries[1].id, 'fantasy-football');
  assert.equal(queries[2].id, 'sports-data-viz');
});

test('sports analytics RSS preserves the real syndicated publisher and rich fantasy tags', () => {
  const spec = sportsAnalyticsQueries().find((query) => query.id === 'fantasy-football');
  assert.ok(spec);
  const [item] = parseSportsAnalyticsNewsRss(rss, spec!);
  assert.ok(item);
  assert.equal(item.source, 'fantasypros.com');
  assert.equal(item.sourceKind, 'rss');
  assert.equal(item.lane, 'sports');
  assert.ok(item.tags.includes('fantasy football'));
  assert.ok(item.tags.includes('superflex'));
  assert.ok(item.tags.includes('2qb'));
  assert.equal(isFrontierSourceAdmitted(item), true);
});
