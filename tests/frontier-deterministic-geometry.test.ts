import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichFrontierMediaGeometry,
  frontierMediaGeometry,
} from '../lib/frontier/media/geometry';
import type { FrontierItem } from '../lib/frontier/types';

function item(media: FrontierItem['media']): FrontierItem {
  return {
    id: 'geometry-test',
    title: 'Geometry test',
    summary: 'A deterministic media geometry fixture.',
    url: 'https://example.com/item',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'local',
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'builder_signal',
    tags: ['test'],
    media,
    baseScore: 0.5,
    importance: 0.5,
    novelty: 0.5,
    quality: 0.5,
    momentum: 0.5,
  };
}

test('unknown images reserve a square box while video defaults to wide geometry', () => {
  const image = frontierMediaGeometry({ type: 'image', url: '/image.webp' });
  const video = frontierMediaGeometry({ type: 'video', url: 'https://example.com/video.mp4' });

  assert.equal(image.label, 'square');
  assert.equal(image.aspectRatio, 1);
  assert.equal(image.cssAspectRatio, '1 / 1');
  assert.equal(video.label, 'wide');
  assert.equal(video.aspectRatio, 16 / 9);
  assert.equal(video.cssAspectRatio, '16 / 9');
});

test('real source dimensions are preferred over categorical fallback geometry', () => {
  const geometry = frontierMediaGeometry({
    type: 'image',
    url: '/image.webp',
    width: 1200,
    height: 800,
  });

  assert.equal(geometry.aspectRatio, 1.5);
  assert.equal(geometry.cssAspectRatio, '1200 / 800');
  assert.equal(geometry.label, 'landscape');
});

test('pathological source dimensions are clamped before they can distort the grid', () => {
  const wide = frontierMediaGeometry({ type: 'image', url: '/wide.webp', width: 10_000, height: 10 });
  const tall = frontierMediaGeometry({ type: 'image', url: '/tall.webp', width: 10, height: 10_000 });

  assert.equal(wide.aspectRatio, 2.4);
  assert.equal(wide.cssAspectRatio, '2.4 / 1');
  assert.equal(tall.aspectRatio, 0.5);
  assert.equal(tall.cssAspectRatio, '0.5 / 1');
});

test('presentation enrichment assigns expected geometry without changing ranking evidence', () => {
  const source = item({ type: 'image', url: '/image.webp' });
  const enriched = enrichFrontierMediaGeometry(source);

  assert.notEqual(enriched, source);
  assert.equal(enriched.media?.aspectRatio, 'square');
  assert.equal(enriched.baseScore, source.baseScore);
  assert.equal(enriched.importance, source.importance);
  assert.equal(enriched.novelty, source.novelty);
  assert.equal(enriched.quality, source.quality);
  assert.equal(enriched.momentum, source.momentum);
  assert.equal(source.media?.aspectRatio, undefined);
});

test('chart and absent media remain outside deterministic visual geometry', () => {
  const noMedia = item(undefined);
  const chart = item({ type: 'chart' });

  assert.equal(enrichFrontierMediaGeometry(noMedia), noMedia);
  assert.equal(enrichFrontierMediaGeometry(chart), chart);
});
