import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFrontierEditorialText, cleanFrontierItem, isFrontierEditoriallyUsable } from '../lib/frontier/editorialQuality';
import { buildFrontierSourceBrief } from '../lib/frontier/sourceBrief';
import { FRONTIER_WATCH_CHANNELS, parseWatchChannelFeed } from '../lib/frontier/watchableSources';
import type { FrontierItem } from '../lib/frontier/types';

const base: FrontierItem = {
  id: 'sample-film', title: 'The NBA tightened its rules…and it is glorious',
  url: 'https://www.youtube.com/watch?v=yvNpoXd3sRc',
  summary: '', source: 'youtube.com', sourceLabel: 'Thinking Basketball',
  sourceKind: 'youtube', publishedAt: '2026-11-01T12:00:00.000Z',
  lane: 'sports', tags: ['sports analytics', 'basketball'],
  baseScore: 0.8, importance: 0.7, novelty: 0.7, momentum: 0.7, quality: 0.7,
};
const promotionalDescription =
  'Use our code for 10% off your next SeatGeek order*: https://seatgeek.onelink.me/RrnK/THINKING10 ' +
  'Sponsored by SeatGeek. *Restrictions apply. Max $20 discount ' +
  'Become a member to access all full length videos: https://www.youtube.com/channel/UC3HPbvB6f58X_7SMIp6OPYw/join ' +
  'This detailed film breakdown & scouting report explores the NBA officiating changes in 2027 ' +
  'to combat flopping, offensive fouls, moving screens and more. ' +
  'Podcast: https://open.spotify.com/show/12kpkAvUj6LGxzViDIH0qH ' +
  'Support at Patreon: https://www.patreon.com/thinkingbasketball ' +
  'Website: https://www.thinkingbasketball.net Stats courtesy: https://stats.nba.com';

test('production NBA example keeps original analytical passage but removes sponsor and membership clutter', () => {
  const cleaned = cleanFrontierEditorialText(promotionalDescription, 'youtube');
  assert.match(cleaned, /^This detailed film breakdown & scouting report explores/);
  for (const token of ['SeatGeek', 'THINKING10', 'Sponsored by', 'Become a member',
    'Podcast:', 'Patreon', 'stats.nba.com']) {
    assert.equal(cleaned.includes(token), false, 'promotional content leaked: ' + token);
  }
  assert.match(cleaned, /officiating changes in 2027/);
  const vetted = cleanFrontierItem({ ...base, summary: promotionalDescription });
  assert.equal(vetted.summary, cleaned);
  assert.equal(isFrontierEditoriallyUsable(vetted), true);
  assert.equal(buildFrontierSourceBrief(promotionalDescription, 'youtube').lead, cleaned);
});

test('a promotional-only video is not promoted into a misleading editorial story', () => {
  const promo = 'Use our code for 20% off exclusive tickets: https://example.com/deal ' +
    'Sponsored by SeatGeek. Become a member to access bonus videos: https://example.com/join';
  assert.equal(cleanFrontierEditorialText(promo, 'youtube'), '');
  assert.equal(isFrontierEditoriallyUsable({ ...base, summary: promo }), false);
});

test('genuine source summaries preserve facts and do not fabricate extra conclusions', () => {
  const scientific = 'The authors evaluated synchronization error across 15 recorded physiological streams and ' +
    'reported a baseline latency distribution. Independent replication remains to be completed.';
  assert.equal(cleanFrontierEditorialText(scientific, 'arxiv'), scientific);
  assert.equal(isFrontierEditoriallyUsable({ ...base, sourceKind: 'arxiv', summary: scientific }), true);
  assert.equal(cleanFrontierEditorialText('Sponsor: SeatGeek', 'youtube'), '');
});

test('a curated channel feed stores the substantive excerpt, never an ad or generic invented synopsis', () => {
  const channel = FRONTIER_WATCH_CHANNELS[0];
  const publishedAt = new Date(Date.now() - 86_400_000).toISOString();
  const atom = '<feed><entry><yt:videoId>yvNpoXd3sRc</yt:videoId>' +
    '<title>Film study: NBA officiating changes</title><published>' + publishedAt + '</published>' +
    '<media:description>' + promotionalDescription.replaceAll('&', '&amp;') +
    '</media:description></entry></feed>';
  const [item] = parseWatchChannelFeed(atom, channel);
  assert.ok(item, 'Source analysis must survive cleaning');
  assert.match(item.summary, /^This detailed film breakdown/);
  assert.doesNotMatch(item.summary, /SeatGeek|Patreon|https:\/\//);
});

test('provider description containing only CTAs is excluded at acquisition', () => {
  const channel = FRONTIER_WATCH_CHANNELS[0];
  const publishedAt = new Date(Date.now() - 86_400_000).toISOString();
  const atom = '<feed><entry><yt:videoId>yvNpoXd3sRc</yt:videoId>' +
    '<title>Exclusive promotion</title><published>' + publishedAt + '</published>' +
    '<media:description>Use our code for 10% off and become a member https://example.com</media:description>' +
    '</entry></feed>';
  assert.deepEqual(parseWatchChannelFeed(atom, channel), []);
});
