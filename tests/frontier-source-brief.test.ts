import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFrontierSourceBrief, frontierRatingDescription, frontierSourceFigures } from '../lib/frontier/sourceBrief';
import type { FrontierItem } from '../lib/frontier/types';

const item: FrontierItem = {
  id: 'demo-1',
  title: 'Measured result',
  summary: 'A result was reported.',
  url: 'https://example.org/article',
  source: 'example.org',
  sourceLabel: 'Example Publisher',
  sourceKind: 'local',
  publishedAt: '2026-10-31T00:00:00Z',
  lane: 'broad_science',
  tags: ['science'],
  baseScore: 0.8, importance: 0.8, novelty: 0.8, quality: 0.8, momentum: 0.6,
};

test('the brief never fabricates evidence from short or absent summaries', () => {
  assert.deepEqual(buildFrontierSourceBrief(''), { lead: '', details: [], hasFullerContext: false });
  assert.deepEqual(buildFrontierSourceBrief('Exactly one documented observation.'), {
    lead: 'Exactly one documented observation.', details: [], hasFullerContext: false,
  });
});

test('long summaries preserve every source sentence and its original order', () => {
  const summary = [
    'Researchers analyzed records from multiple sessions and documented a shift in observed performance.',
    'The teams compared the reported performance against their earlier reference measurements.',
    'Their source also describes an independent replication attempt using a smaller sample.',
    'No external validation results were published in the linked report.',
  ].join(' ');
  const brief = buildFrontierSourceBrief(summary);
  assert.equal([brief.lead, ...brief.details].join(' '), summary);
  assert(brief.hasFullerContext);
  assert(brief.details.length > 0);
});

test('source figures are deduplicated, attributed and capped without generating extra media', () => {
  const result = frontierSourceFigures({
    ...item,
    media: { type: 'image', url: 'https://example.org/hero.png', alt: 'Source illustration' },
    figures: [
      { url: 'https://example.org/hero.png', alt: 'duplicate' },
      { url: 'https://example.org/figure-2.png', alt: 'Actual figure two', caption: 'Measured values', credit: 'Original authors' },
      { url: 'https://localhost/private.png', alt: 'Blocked' },
      { url: 'https://192.168.1.2/private.png', alt: 'Blocked private IP' },
      { url: 'javascript:alert(1)', alt: 'Blocked script' },
    ],
  });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((figure) => figure.url), ['https://example.org/hero.png', 'https://example.org/figure-2.png']);
  assert.equal(result[1].caption, 'Measured values');
  assert.equal(result[1].credit, 'Original authors');
  assert.equal(frontierSourceFigures({ ...item, media: { type: 'none' } }).length, 0);
});

test('publisher original image is a validated fallback when HD proxy fails', () => {
  const figures = frontierSourceFigures({
    ...item,
    media: {
      type: 'image',
      url: 'https://i.guim.co.uk/example.jpg?width=140',
      proxyUrl: '/api/frontier/media?url=https%3A%2F%2Fi.guim.co.uk%2Fexample.jpg%3Fwidth%3D2048',
      alt: 'Complete photograph',
    },
  });
  assert.equal(figures[0].url.startsWith('/api/frontier/media?'), true);
  assert.equal(figures[0].fallbackUrl, 'https://i.guim.co.uk/example.jpg?width=140');
  assert.equal(figures[0].alt, 'Complete photograph');
  const invalid = frontierSourceFigures({
    ...item,
    media: {
      type: 'image',
      url: 'http://localhost/private',
      proxyUrl: '/api/frontier/media?url=https%3A%2F%2Fi.guim.co.uk%2Fexample.jpg',
    },
  });
  assert.equal(invalid[0].fallbackUrl, undefined, 'Unsafe direct-image fallback must never leak into a browser tag');
});

test('balloon labels remain readable throughout the explicit 1–10 grading scale', () => {
  assert.equal(frontierRatingDescription(undefined), 'Hold to rate');
  assert.equal(frontierRatingDescription(1), 'Low interest');
  assert.equal(frontierRatingDescription(5), 'Worth knowing');
  assert.equal(frontierRatingDescription(8), 'Very interesting');
  assert.equal(frontierRatingDescription(10), 'Loved it');
});
