import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  FRONTIER_DIRECT_MUSIC_FEEDS,
  parseDirectMusicRss,
  parsePersonalMusicNewsRss,
  pickDailyMusicQueries,
} from '../lib/frontier/personalTasteSources';

test('keyless music radar rotates checked-in artists and always keeps a broad bass query', () => {
  const queries = pickDailyMusicQueries('2026-08-24', 4);
  assert.equal(queries.length, 5);
  assert.equal(queries.at(-1)?.id, 'bass-frontier');
  assert.ok(queries.slice(0, 4).every((query) => query.artists.length === 1));
  assert.equal(new Set(queries.slice(0, 4).flatMap((query) => query.artists)).size, 4);
});

test('direct bass radar uses vetted specialist feeds without optional credentials', () => {
  assert.deepEqual(
    FRONTIER_DIRECT_MUSIC_FEEDS.map((feed) => feed.host),
    ['edm.com', 'dancingastronaut.com'],
  );
});

test('music query intent cannot label an unrelated returned story as bass music', () => {
  const spec = { id: 'artist-test', query: '"ILLENIUM" new release', artists: ['ILLENIUM'] };
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>ILLENIUM shares a new melodic bass remix</title>
      <link>https://news.google.com/rss/articles/music-good</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>The producer returns with a melodic bass release and festival-ready remix.</description>
      <source url="https://www.billboard.com/">Billboard</source>
    </item>
    <item>
      <title>City council approves a new transit budget</title>
      <link>https://news.google.com/rss/articles/unrelated</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>The unrelated local policy story appeared in the search results.</description>
      <source url="https://www.billboard.com/">Billboard</source>
    </item>
  </channel></rss>`;

  const items = parsePersonalMusicNewsRss(xml, spec, Date.parse('2026-08-24T12:00:00Z'));
  assert.equal(items.length, 1);
  assert.match(items[0].title, /ILLENIUM/);
  assert.equal(items[0].lane, 'music');
  assert.ok(items[0].tags.includes('illenium'));
  assert.ok(items[0].tags.includes('bass music'));
  assert.equal(items[0].source, 'billboard.com');
  assert.equal(isFrontierSourceAdmitted(items[0]), true);
});

test('broad bass radar requires returned-copy evidence rather than its query text', () => {
  const spec = { id: 'bass-frontier', query: 'dubstep bass music new release', artists: [] };
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Virtual Riot unveils a new dubstep release</title>
      <link>https://news.google.com/rss/articles/bass-good</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>A heavy dubstep single arrives ahead of the next live set.</description>
      <source url="https://www.billboard.com/">Billboard</source>
    </item>
    <item>
      <title>New telescope maps a distant galaxy</title>
      <link>https://news.google.com/rss/articles/space-unrelated</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>Astronomers released a new image today.</description>
      <source url="https://www.billboard.com/">Billboard</source>
    </item>
  </channel></rss>`;

  const items = parsePersonalMusicNewsRss(xml, spec, Date.parse('2026-08-24T12:00:00Z'));
  assert.deepEqual(items.map((item) => item.title), ['Virtual Riot unveils a new dubstep release']);
});

test('direct specialist RSS preserves publisher provenance and rejects unrelated copy', () => {
  const feed = FRONTIER_DIRECT_MUSIC_FEEDS[0];
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Subtronics drops a new dubstep single</title>
      <link>https://edm.com/music-releases/subtronics-example</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>The bass music producer previews the track before a festival live set.</description>
    </item>
    <item>
      <title>Festival operator announces a parking expansion</title>
      <link>https://edm.com/news/parking-example</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <description>The venue added another parking lot.</description>
    </item>
  </channel></rss>`;

  const items = parseDirectMusicRss(xml, feed, Date.parse('2026-08-24T12:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'edm.com');
  assert.equal(items[0].sourceLabel, 'EDM.com');
  assert.equal(items[0].lane, 'music');
  assert.ok(items[0].tags.includes('subtronics'));
  assert.ok(items[0].tags.includes('bass music'));
  assert.equal(isFrontierSourceAdmitted(items[0]), true);
});
