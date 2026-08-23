import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierHasPresentationMedia,
  frontierMasonrySpan,
  frontierPackedColumnSpans,
  frontierVisualRole,
} from '../lib/frontier/presentation/mediaForward';
import type { FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'test-item',
    source: 'test',
    sourceKind: 'rss',
    sourceLabel: 'Test',
    title: 'A useful signal',
    summary: 'A compact summary.',
    url: 'https://example.com/story',
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'ai_frontier',
    tags: ['test'],
    baseScore: 0.8,
    quality: 0.8,
    novelty: 0.6,
    importance: 0.6,
    momentum: 0.5,
    why: 'test',
    ...overrides,
  };
}

test('presentation media recognizes real visual formats but not charts or absent media', () => {
  assert.equal(frontierHasPresentationMedia(item()), false);
  assert.equal(frontierHasPresentationMedia(item({ media: { type: 'chart' } })), false);
  assert.equal(frontierHasPresentationMedia(item({ media: { type: 'image', url: 'https://example.com/a.jpg' } })), true);
  assert.equal(frontierHasPresentationMedia(item({ media: { type: 'youtube', url: 'abcdefghi' } })), true);
});

test('video and priority media become hero surfaces while ordinary images remain visual', () => {
  assert.equal(frontierVisualRole(item({ media: { type: 'video', url: 'https://example.com/a.mp4' } }), 3, true), 'hero');
  assert.equal(frontierVisualRole(item({ highPriority: true, media: { type: 'image', url: 'https://example.com/a.jpg' } }), 3, true), 'hero');
  assert.equal(frontierVisualRole(item({ media: { type: 'image', url: 'https://example.com/a.jpg' } }), 3, true), 'visual');
});

test('important visual items become wide without promoting ordinary text cards', () => {
  assert.equal(frontierVisualRole(item({ importance: 0.9, media: { type: 'image', url: 'https://example.com/a.jpg' } }), 2, true), 'wide');
  assert.equal(frontierVisualRole(item({ importance: 0.9 }), 2, false), 'compact');
});

test('structured evidence keeps a standard footprint while plain text stays compact', () => {
  assert.equal(frontierVisualRole(item({ metrics: [{ label: 'AUC', value: '0.91' }] }), 4, false), 'standard');
  assert.equal(frontierVisualRole(item({ artifacts: [{ kind: 'benchmark', label: 'AUC', value: '0.91' }] }), 4, false), 'standard');
  assert.equal(frontierVisualRole(item(), 4, false), 'compact');
});

test('ordered packing fills complete 12-column rows without dense reordering', () => {
  const items = [
    item({ id: 'video-a', media: { type: 'video', url: 'https://example.com/a.mp4' } }),
    item({ id: 'text-a' }),
    item({ id: 'text-b' }),
    item({ id: 'image-wide', importance: 0.9, media: { type: 'image', url: 'https://example.com/b.jpg' } }),
    item({ id: 'video-b', media: { type: 'youtube', url: 'abcdefghi' } }),
  ];
  const spans = frontierPackedColumnSpans(items);
  assert.deepEqual(spans, [8, 4, 4, 8, 8]);
  assert.equal(spans.slice(0, 2).reduce((sum, span) => sum + span, 0), 12);
  assert.equal(spans.slice(2, 4).reduce((sum, span) => sum + span, 0), 12);
  assert.equal(items.map((entry) => entry.id).join('|'), 'video-a|text-a|text-b|image-wide|video-b');
});

test('masonry span converts measured content height into dense grid rows deterministically', () => {
  assert.equal(frontierMasonrySpan(0), 1);
  assert.equal(frontierMasonrySpan(8), 1);
  assert.equal(frontierMasonrySpan(180, 8, 10), 11);
  assert.equal(frontierMasonrySpan(360, 8, 10), 21);
  assert.equal(frontierMasonrySpan(Number.NaN), 1);
});
