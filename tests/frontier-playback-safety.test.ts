import assert from 'node:assert/strict';
import test from 'node:test';
import { isFrontierPlaybackSafe } from '../lib/frontier/live/seenLedger';
import type { FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'video',
    title: 'Useful video',
    summary: 'A current signal.',
    url: 'https://www.youtube.com/watch?v=abc123xyz00',
    source: 'youtube.com',
    sourceLabel: 'YouTube',
    sourceKind: 'youtube',
    publishedAt: '2026-08-24T12:00:00.000Z',
    lane: 'sports',
    tags: ['video', 'watchable'],
    media: { type: 'youtube', url: 'abc123xyz00', aspectRatio: 'wide' },
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.7,
    momentum: 0.5,
    ...overrides,
  };
}

test('legacy NFL and Patriots YouTube cards are rejected before cache/seen processing', () => {
  assert.equal(isFrontierPlaybackSafe(item({ title: 'NFL Week 1 highlights' })), false);
  assert.equal(isFrontierPlaybackSafe(item({ tags: ['new england patriots', 'video'] })), false);
});

test('non-NFL YouTube and direct ESPN highlight video remain playable', () => {
  assert.equal(isFrontierPlaybackSafe(item({ title: 'Thinking Basketball Warriors film study', tags: ['nba', 'warriors', 'video'] })), true);
  assert.equal(isFrontierPlaybackSafe(item({
    title: 'Patriots highlight',
    url: 'https://www.espn.com/video/clip?id=1',
    source: 'espn.com',
    sourceLabel: 'ESPN',
    sourceKind: 'sports_state',
    media: { type: 'video', url: 'https://media.video-cdn.espn.com/mp4/example.mp4', aspectRatio: 'wide' },
    tags: ['nfl', 'patriots', 'sports highlight'],
  })), true);
});
