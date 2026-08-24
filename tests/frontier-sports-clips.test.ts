import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  FRONTIER_SPORTS_CLIP_QUERIES,
  isAllowedSportsClipUrl,
  sportsClipItemFromResult,
} from '../lib/frontier/sportsClipSources';

const patriots = FRONTIER_SPORTS_CLIP_QUERIES.find((query) => query.id === 'patriots-nfl-clips');
assert.ok(patriots);

test('sports clip allowlist covers requested social and specialist sources without opening the whole web', () => {
  for (const url of [
    'https://x.com/NFL/status/123',
    'https://www.threads.net/@sports/post/example',
    'https://www.tiktok.com/@sports/video/123',
    'https://bleacherreport.com/articles/example',
    'https://sleeper.com/news/example',
  ]) {
    assert.equal(isAllowedSportsClipUrl(url), true, url);
  }
  assert.equal(isAllowedSportsClipUrl('https://random-unvetted.example/video'), false);
  assert.equal(isAllowedSportsClipUrl('javascript:alert(1)'), false);
});

test('X and Threads discoveries remain external-playback cards rather than fragile embeds', async () => {
  const item = await sportsClipItemFromResult({
    title: 'Patriots red-zone rep worth replaying',
    url: 'https://x.com/NFL/status/123',
    description: 'A short Patriots film clip.',
    thumbnail: { src: 'https://pbs.twimg.com/media/example.jpg' },
  }, patriots!, false);
  assert.ok(item);
  assert.equal(item!.sourceKind, 'social');
  assert.equal(item!.sourceLabel, 'X');
  assert.equal(item!.media?.type, 'image');
  assert.notEqual(item!.media?.type, 'video');
  assert.notEqual(item!.media?.type, 'youtube');
  assert.equal(item!.actionLabel, 'Watch on X');
  assert.ok(item!.tags.includes('watchable'));
  assert.equal(isFrontierSourceAdmitted(item!), true);
});

test('TikTok discovery is source-hosted and never stores executable embed HTML', async () => {
  const item = await sportsClipItemFromResult({
    title: 'Quick Patriots breakdown',
    url: 'https://www.tiktok.com/@film/video/123456789',
    description: 'Short football film note.',
    thumbnail: { src: 'https://p16-sign.tiktokcdn-us.com/example.jpg' },
  }, patriots!, false);
  assert.ok(item);
  assert.equal(item!.sourceKind, 'social');
  assert.equal(item!.sourceLabel, 'TikTok');
  assert.equal(item!.actionLabel, 'Watch on TikTok');
  assert.equal(item!.media?.type, 'image');
  assert.ok(!JSON.stringify(item).includes('<script'));
  assert.ok(!JSON.stringify(item).includes('<blockquote'));
});

test('Bleacher Report and Sleeper survive provenance vetting but do not inherit primary-source authority', async () => {
  const bleacher = await sportsClipItemFromResult({
    title: 'Patriots camp clip',
    url: 'https://bleacherreport.com/articles/patriots-camp',
    description: 'A useful camp clip.',
  }, patriots!, false);
  const sleeper = await sportsClipItemFromResult({
    title: 'Fantasy usage clip',
    url: 'https://sleeper.com/news/fantasy-usage',
    description: 'Fantasy football usage note.',
  }, patriots!, false);
  assert.ok(bleacher && sleeper);
  assert.equal(bleacher!.sourceKind, 'brave_web');
  assert.equal(sleeper!.sourceKind, 'brave_web');
  assert.equal(isFrontierSourceAdmitted(bleacher!), true);
  assert.equal(isFrontierSourceAdmitted(sleeper!), true);
});
