import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  parseSportsAnalyticsNewsRss,
  sportsAnalyticsEvidenceMatches,
  sportsAnalyticsQueries,
} from '../lib/frontier/sportsAnalyticsSources';

const DAY_MS = 86_400_000;

function rssDate(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toUTCString();
}

function fantasyRss(pubDate = rssDate(1)): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>Superflex draft values shift after target-share and route-participation update</title>
    <link>https://news.google.com/rss/articles/example-fantasy</link>
    <guid>https://news.google.com/rss/articles/example-fantasy</guid>
    <pubDate>${pubDate}</pubDate>
    <description>New ADP and usage analysis for 2QB fantasy football formats.</description>
    <source url="https://www.fantasypros.com/">FantasyPros</source>
  </item>
</channel></rss>`;
}

function fuzzyNflRss(pubDate = rssDate(1)): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>Chelsea change course with new tactical shape</title>
    <link>https://news.google.com/rss/articles/example-chelsea</link>
    <guid>https://news.google.com/rss/articles/example-chelsea</guid>
    <pubDate>${pubDate}</pubDate>
    <description>Premier League football analysis of Chelsea's pressing structure.</description>
    <source url="https://www.theguardian.com/">The Guardian</source>
  </item>
</channel></rss>`;
}

test('sports analytics radar pins NFL, fantasy, role news, and visualization searches', () => {
  const queries = sportsAnalyticsQueries();
  assert.equal(queries.length, 5);
  assert.equal(queries[0].id, 'nfl-analytics');
  assert.equal(queries[1].id, 'fantasy-football');
  assert.equal(queries[2].id, 'nfl-role-news');
  assert.equal(queries[3].id, 'sports-data-viz');
  assert.match(queries[0].query, /Patriots/i);
  assert.match(queries[2].query, /injury/i);
  assert.match(queries[2].query, /depth chart/i);
  assert.match(queries[2].query, /beat reporter/i);
});

test('rotating analytics query stays anchored to a favorite NBA or soccer team orbit', () => {
  const rotating = sportsAnalyticsQueries()[4];
  assert.ok(['nba-analytics', 'soccer-analytics'].includes(rotating.id));
  if (rotating.id === 'nba-analytics') assert.match(rotating.query, /Golden State Warriors/i);
  if (rotating.id === 'soccer-analytics') {
    assert.match(rotating.query, /Chelsea/i);
    assert.match(rotating.query, /Manchester City/i);
  }
});

test('sports analytics RSS preserves the real syndicated publisher and rich fantasy tags', () => {
  const spec = sportsAnalyticsQueries().find((query) => query.id === 'fantasy-football');
  assert.ok(spec);
  const [item] = parseSportsAnalyticsNewsRss(fantasyRss(), spec!);
  assert.ok(item);
  assert.equal(item.source, 'fantasypros.com');
  assert.equal(item.sourceKind, 'rss');
  assert.equal(item.lane, 'sports');
  assert.ok(item.tags.includes('fantasy football'));
  assert.ok(item.tags.includes('superflex'));
  assert.ok(item.tags.includes('2qb'));
  assert.equal(isFrontierSourceAdmitted(item), true);
});

test('sports analytics RSS keeps the ten-day freshness gate fail-closed', () => {
  const spec = sportsAnalyticsQueries().find((query) => query.id === 'fantasy-football');
  assert.ok(spec);
  assert.deepEqual(parseSportsAnalyticsNewsRss(fantasyRss(rssDate(11)), spec!), []);
});

test('targeted sports queries require returned evidence before assigning query semantics', () => {
  const nfl = sportsAnalyticsQueries().find((query) => query.id === 'nfl-analytics');
  assert.ok(nfl);
  assert.equal(
    sportsAnalyticsEvidenceMatches('NFL player tracking analysis compares EPA and CPOE for Patriots drives', nfl!),
    true,
  );
  assert.equal(
    sportsAnalyticsEvidenceMatches('Adaptive separation for long-horizon world models', nfl!),
    false,
  );
  assert.deepEqual(parseSportsAnalyticsNewsRss(fuzzyNflRss(), nfl!), []);
});