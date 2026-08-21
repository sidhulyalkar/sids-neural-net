import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_ACTIVE_SPORTS,
  personalInterestTags,
  personalLaneForText,
  pickDailyActiveSports,
} from '../lib/frontier/interests';
import {
  parseActiveSportNewsRss,
  parseActiveSportRedditListing,
} from '../lib/frontier/activeSportsSources';

function sport(id: string) {
  const found = FRONTIER_ACTIVE_SPORTS.find((candidate) => candidate.id === id);
  assert.ok(found, `Missing active sport ${id}`);
  return found;
}

test('active sports profile includes every explicitly requested discipline', () => {
  const labels = new Set(FRONTIER_ACTIVE_SPORTS.map((item) => item.label.toLowerCase()));
  for (const expected of [
    'rock climbing',
    'skateboarding',
    'longboarding',
    'skiing',
    'soccer',
    'ripstik',
    'ripsurf',
    'mountain biking',
  ]) {
    assert.ok(labels.has(expected));
  }
});

test('active sports rotate into a finite daily discovery set', () => {
  const daily = pickDailyActiveSports('2026-08-21', 4);
  assert.equal(daily.length, 4);
  assert.equal(new Set(daily.map((item) => item.id)).size, 4);
  assert.ok(daily.every((item) => item.tags.includes('active sport')));
});

test('personal classification recognizes ride and climb vocabulary', () => {
  assert.equal(personalLaneForText('IFSC bouldering final sends were wild'), 'sports');
  assert.equal(personalLaneForText('UCI downhill MTB race run'), 'sports');
  assert.equal(personalLaneForText('RipSurf waveboard land surfing tricks'), 'sports');
  assert.equal(personalLaneForText('soccer technique and football skills session'), 'world_soccer');

  const tags = personalInterestTags('street skateboarding best trick and longboarding freeride');
  assert.ok(tags.includes('skateboarding'));
  assert.ok(tags.includes('longboarding'));
  assert.ok(tags.includes('active sport'));
});

test('professional sports RSS becomes a provenance-rich active sport signal', () => {
  const climbing = sport('rock-climbing');
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title>Climber wins a dramatic bouldering final</title>
    <link>https://example.com/climbing-final</link>
    <description><![CDATA[A close competition with a decisive final problem.]]></description>
    <pubDate>Thu, 20 Aug 2026 10:00:00 GMT</pubDate>
    <source>Example Sports</source>
  </item></channel></rss>`;
  const parsed = parseActiveSportNewsRss(xml, climbing);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lane, 'sports');
  assert.ok(parsed[0].tags.includes('rock climbing'));
  assert.ok(parsed[0].tags.includes('professional news'));
  assert.equal(parsed[0].sourceLabel, 'Example Sports');
});

test('top community video posts become playable active sport clips', () => {
  const mountainBiking = sport('mountain-biking');
  const parsed = parseActiveSportRedditListing({
    data: {
      children: [{
        data: {
          id: 'mtb-clip-1',
          title: 'Ridiculous downhill race run from this weekend',
          subreddit: 'mountainbiking',
          permalink: '/r/mountainbiking/comments/abc123/example/',
          created_utc: Math.floor(Date.now() / 1000),
          score: 3200,
          num_comments: 240,
          url_overridden_by_dest: 'https://www.youtube.com/watch?v=abc123XYZ',
          preview: { images: [{ source: { url: 'https://example.com/mtb.jpg' } }] },
        },
      }],
    },
  }, mountainBiking, 'mountainbiking');

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lane, 'sports');
  assert.equal(parsed[0].sourceKind, 'reddit');
  assert.equal(parsed[0].media?.type, 'youtube');
  assert.equal(parsed[0].media?.url, 'abc123XYZ');
  assert.ok(parsed[0].tags.includes('clip'));
});
