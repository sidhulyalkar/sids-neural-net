import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { FRONTIER_GAME_LIBRARY, FRONTIER_MUSIC_ARTISTS, pickDailySubreddits } from '../lib/frontier/interests';
import { parseRedditListing } from '../lib/frontier/personalSources';
import {
  applyReactionToProfile,
  isDueForResurface,
  personalizedScore,
  rankFrontierItems,
  selectDailyRun,
} from '../lib/frontier/scoring';
import { parseFrontierRss, parseYouTubeAtom } from '../lib/frontier/sources';
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

test('personal cold start includes the favorite-team and bass orbit', () => {
  const profile = createInitialProfile();
  assert.ok(profile.topicAffinity.patriots > 0);
  assert.ok(profile.topicAffinity.warriors > 0);
  assert.ok(profile.topicAffinity.chelsea > 0);
  assert.ok(profile.topicAffinity['manchester city'] > 0);
  assert.ok(profile.topicAffinity.dubstep > 0);
  assert.ok(profile.laneAffinity.team_pulse > 0);
  assert.ok(profile.laneAffinity.music > 0);
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

test('daily run reserves brainfood, favorite-team, gaming, and broader sports when present', () => {
  const signals = [
    item({ id: 'important', lane: 'must_know', importance: 0.95, title: 'Major release' }),
    item({ id: 'ml', lane: 'ml_data', title: 'New data analysis method' }),
    item({ id: 'code', lane: 'builder_signal', sourceKind: 'github', title: 'Useful public repository', tags: ['open source'] }),
    item({ id: 'team', lane: 'team_pulse', sourceKind: 'reddit', title: 'Patriots roster move', tags: ['patriots'] }),
    item({ id: 'pl', lane: 'premier_league', title: 'Premier League tactical shift', tags: ['premier league', 'tactics'] }),
    item({ id: 'game', lane: 'gaming', sourceKind: 'steam', title: 'Hollow Knight update', tags: ['hollow knight'] }),
    item({ id: 'music', lane: 'music', title: 'New bass release', tags: ['dubstep'] }),
    item({ id: 'wild', lane: 'wildcards', title: 'Unexpected adjacent idea', novelty: 0.9, tags: ['unexpected'] }),
  ];
  const ranked = rankFrontierItems(signals, createInitialProfile(), {});
  const run = selectDailyRun(ranked, {}, 8);
  assert.ok(run.some((signal) => signal.lane === 'ml_data'));
  assert.ok(run.some((signal) => signal.lane === 'builder_signal'));
  assert.ok(run.some((signal) => signal.lane === 'team_pulse'));
  assert.ok(run.some((signal) => signal.lane === 'premier_league'));
  assert.ok(run.some((signal) => signal.lane === 'gaming'));
  assert.ok(run.some((signal) => signal.lane === 'music'));
});

test('daily subreddit rotation always contains the four favorite-team communities', () => {
  const selected = pickDailySubreddits('2026-08-20');
  for (const subreddit of ['Patriots', 'warriors', 'chelseafc', 'MCFC']) {
    assert.ok(selected.includes(subreddit));
  }
  assert.ok(selected.length <= 15);
});

test('steam library seed contains representative games from the supplied library', () => {
  const titles = new Set(FRONTIER_GAME_LIBRARY.map((game) => game.title.toLowerCase()));
  for (const title of ['elden ring', 'hollow knight: silksong', 'nine sols', 'dead cells', 'tunic', 'rain world']) {
    assert.ok(titles.has(title));
  }
});

test('music taste seed supplies artist names to the discovery orbit', () => {
  const names = new Set(FRONTIER_MUSIC_ARTISTS.map((artist) => artist.toLowerCase()));
  assert.ok(names.has('illenium'));
  assert.ok(names.has('virtual riot'));
  assert.ok(names.has('skrillex'));
});

test('reddit parser maps favorite-team community posts into the team pulse lane', () => {
  const parsed = parseRedditListing({
    data: {
      children: [{
        data: {
          id: 'pats-1',
          title: 'Patriots rookie flashes in practice clip',
          subreddit: 'Patriots',
          permalink: '/r/Patriots/comments/pats1/example/',
          created_utc: 1787250000,
          score: 1420,
          num_comments: 188,
          preview: { images: [{ source: { url: 'https://example.com/pats.jpg' } }] },
        },
      }],
    },
  }, 'Patriots');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lane, 'team_pulse');
  assert.equal(parsed[0].sourceKind, 'reddit');
  assert.equal(parsed[0].sourceLabel, 'r/Patriots');
  assert.equal(parsed[0].media?.url, 'https://example.com/pats.jpg');
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

test('youtube atom parser creates a playable visual signal with channel provenance', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
    <entry>
      <yt:videoId>abc123XYZ</yt:videoId>
      <title>Premier League xG and pressing explained</title>
      <published>2026-08-20T09:00:00+00:00</published>
      <author><name>Football Data Lab</name></author>
      <media:group>
        <media:description>How pressing shapes expected goals in the Premier League.</media:description>
        <media:thumbnail url="https://i.ytimg.com/vi/abc123XYZ/hqdefault.jpg" width="480" height="360" />
      </media:group>
    </entry>
  </feed>`;
  const parsed = parseYouTubeAtom(xml);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lane, 'premier_league');
  assert.equal(parsed[0].sourceLabel, 'Football Data Lab');
  assert.equal(parsed[0].media?.type, 'youtube');
  assert.equal(parsed[0].media?.url, 'abc123XYZ');
  assert.equal(parsed[0].media?.poster, 'https://i.ytimg.com/vi/abc123XYZ/hqdefault.jpg');
});
