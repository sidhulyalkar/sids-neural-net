import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  FRONTIER_WATCH_CHANNELS,
  parseWatchChannelFeed,
} from '../lib/frontier/watchableSources';

function recentAtom(publishedAt: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>abc123xyz00</yt:videoId>
    <title>Film study: why this coverage rotation changed the game</title>
    <published>${publishedAt}</published>
    <media:group>
      <media:description>A concise sports analysis breakdown with tracking and film context.</media:description>
    </media:group>
  </entry>
</feed>`;
}

test('curated YouTube watch radar stays small and excludes leagues with known embed blocking', () => {
  assert.equal(FRONTIER_WATCH_CHANNELS.length, 3);
  assert.equal(new Set(FRONTIER_WATCH_CHANNELS.map((channel) => channel.channelId)).size, 3);
  assert.ok(!FRONTIER_WATCH_CHANNELS.some((channel) => /nfl/i.test(`${channel.id} ${channel.label}`)));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'thinking-basketball'));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'world-climbing'));
  assert.ok(FRONTIER_WATCH_CHANNELS.some((channel) => channel.id === 'red-bull-bike'));
});

test('YouTube Atom entries become admitted semantic watch signals with stable media geometry', () => {
  const channel = FRONTIER_WATCH_CHANNELS.find((entry) => entry.id === 'thinking-basketball');
  assert.ok(channel);
  // Keep fixture inside the 14-day admission window without depending on wall-clock bitrot.
  const publishedAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const [item] = parseWatchChannelFeed(recentAtom(publishedAt), channel!);
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

test('stale YouTube Atom entries older than 14 days are rejected', () => {
  const channel = FRONTIER_WATCH_CHANNELS.find((entry) => entry.id === 'thinking-basketball');
  assert.ok(channel);
  const publishedAt = new Date(Date.now() - 15 * 86_400_000).toISOString();
  const items = parseWatchChannelFeed(recentAtom(publishedAt), channel!);
  assert.equal(items.length, 0);
});
