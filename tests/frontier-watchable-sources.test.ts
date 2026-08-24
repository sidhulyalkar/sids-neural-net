import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  FRONTIER_WATCH_CHANNELS,
  parseWatchChannelFeed,
} from '../lib/frontier/watchableSources';

const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>abc123xyz00</yt:videoId>
    <title>Film study: why this coverage rotation changed the game</title>
    <published>2026-08-23T18:00:00+00:00</published>
    <media:group>
      <media:description>A concise sports analysis breakdown with tracking and film context.</media:description>
    </media:group>
  </entry>
</feed>`;

test('curated watch radar stays intentionally small and covers analysis plus active sports', () => {
  assert.equal(FRONTIER_WATCH_CHANNELS.length, 4);
  assert.equal(new Set(FRONTIER_WATCH_CHANNELS.map((channel) => channel.channelId)).size, 4);
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'nfl'));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'thinking-basketball'));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'world-climbing'));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'red-bull-bike'));
});

test('YouTube Atom entries become admitted semantic watch signals with stable media geometry', () => {
  const channel = FRONTIER_WATCH_CHANNELS.find((entry) => entry.id === 'thinking-basketball');
  assert.ok(channel);
  const [item] = parseWatchChannelFeed(atom, channel!);
  assert.ok(item);
  assert.equal(item.source, 'youtube.com');
  assert.equal(item.sourceKind, 'youtube');
  assert.equal(item.lane, 'sports');
  assert.ok(item.tags.includes('watchable'));
  assert.ok(item.tags.includes('sports analytics'));
  assert.equal(item.media?.type, 'youtube');
  assert.equal(item.media?.url, 'abc123xyz00');
  assert.equal(item.media?.aspectRatio, 'wide');
  assert.equal(isFrontierSourceAdmitted(item), true);
});
