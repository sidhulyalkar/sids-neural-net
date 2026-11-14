import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { journalMediaDuration, journalMediaPlan, journalSafePublicUrl } from '../lib/frontier/journalMedia';
import { journalFormat } from '../lib/frontier/journalPresentation';
import type { FrontierItem } from '../lib/frontier/types';

const source: FrontierItem = {
  id: 'video', title: 'Real clip', summary: 'The source reports this event.',
  url: 'https://www.espn.com/video/clip/_/id/123', source: 'espn.com',
  sourceLabel: 'ESPN', sourceKind: 'sports_state', publishedAt: '2026-11-13T19:00:00.000Z',
  lane: 'sports', tags: ['sports', 'competition'],
  media: {
    type: 'video', url: 'https://espnmedia-cdn.akamaized.net/espn/media/clip.mp4',
    poster: 'https://espnmedia-cdn.akamaized.net/espn/media/clip.jpg', duration: 80,
  },
  baseScore: 0.8, importance: 0.8, novelty: 0.7, quality: 0.7, momentum: 0.7,
};

test('verified progressive source video can play only from its actual HTTPS asset', () => {
  assert.deepEqual(journalMediaPlan(source), {
    kind: 'direct-video', label: 'Play source clip',
    sourceUrl: 'https://www.espn.com/video/clip/_/id/123',
    playableUrl: 'https://espnmedia-cdn.akamaized.net/espn/media/clip.mp4',
    durationSeconds: 80,
  });
  assert.equal(journalFormat(source, true), 'watch');
  assert.equal(journalMediaDuration(80), '1:20');
  assert.equal(journalMediaDuration(3663), '1:01:03');
  assert.equal(journalMediaDuration(Number.NaN), null);
  assert.equal(journalSafePublicUrl('https://arxiv.org/html/2611.17323v1#S1.F1'),
    'https://arxiv.org/html/2611.17323v1#S1.F1');
  assert.equal(journalSafePublicUrl('https://127.0.0.1/admin'), undefined);
  assert.equal(journalSafePublicUrl('javascript:alert(1)'), undefined);
});

test('YouTube watch surface opens the authentic source without a synthetic embed', () => {
  const youtube: FrontierItem = {
    ...source, id: 'youtube', sourceKind: 'youtube',
    url: 'https://www.youtube.com/watch?v=AH315a5F8-g',
    media: { type: 'youtube', url: 'AH315a5F8-g', poster: 'https://i.ytimg.com/vi/AH315a5F8-g/maxresdefault.jpg' },
  };
  assert.deepEqual(journalMediaPlan(youtube), {
    kind: 'source-video',
    label: 'Watch at original source',
    sourceUrl: 'https://www.youtube.com/watch?v=AH315a5F8-g',
    playableUrl: undefined,
    durationSeconds: undefined,
  });
  assert.equal(journalFormat(youtube, true), 'watch');
});

test('unknown formats, unsafe destinations, and malformed URLs never become direct players', () => {
  assert.equal(journalMediaPlan({ ...source, media: { type: 'image', url: 'https://example.com/photo.jpg' } }), null);
  assert.equal(journalMediaPlan({ ...source, url: 'http://example.com/video' }), null);
  assert.equal(journalMediaPlan({ ...source, url: 'https://localhost/watch' }), null);
  const unsafe = [
    'http://cdn.example.com/file.mp4', 'https://127.0.0.1/video.mp4',
    'https://192.168.1.8/video.mp4', 'https://[::1]/clip.mp4',
    'https://cdn.example.local/clip.mp4', 'https://bad:credentials@cdn.example.com/clip.mp4',
    'javascript:alert(1)', 'https://cdn.example.com/resource.html',
  ];
  for (const url of unsafe) {
    const plan = journalMediaPlan({ ...source, media: { ...source.media!, type: 'video', url } });
    assert.equal(plan?.kind, 'source-video', 'Must not play ' + url);
    assert.equal(plan?.playableUrl, undefined, 'Must not expose ' + url);
  }
  assert.equal(journalMediaPlan({ ...source, media: { ...source.media!, type: 'video',
    url: 'https://cdn.example.com/footage.webm' } })?.kind, 'direct-video');
  assert.equal(journalMediaPlan({ ...source, media: { ...source.media!, type: 'video',
    url: 'https://cdn.example.com/stream.m3u8' } })?.kind, 'source-video');
});

test('match status takes priority over video in the primary exhibit, while video remains available', () => {
  const sports = { ...source, sportsState: {
    kind: 'scoreboard' as const, league: 'test', leagueLabel: 'Fixture',
    games: [{ id: 'one', date: '2026-11-13', status: 'Final', live: false, completed: true,
      competitors: [] }],
  }};
  assert.equal(journalFormat(sports, true), 'live');
  assert.equal(journalMediaPlan(sports)?.kind, 'direct-video');
});

test('media panel is lazy, accessible, and mounted instead of duplicate video posters', () => {
  const reader = fs.readFileSync('components/frontier/FrontierFocusReader.tsx', 'utf8');
  const media = fs.readFileSync('components/frontier/FrontierJournalMedia.tsx', 'utf8');
  assert.match(reader, /<FrontierJournalMedia plan=\{mediaPlan\}/);
  assert.match(reader, /sourceFigures\.filter\(\(figure\) => figure.url !== mediaPosterFigure.url\)/);
  assert.match(media, /preload="metadata"/);
  assert.match(media, /aria-label="Original source video"/);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(media, /plan\.kind === 'direct-video' && activated && !failed/);
  assert.doesNotMatch(media, /<iframe|video.*autoPlay.*muted/);
});
