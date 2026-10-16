import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEditorialClip, editorialClipVariant } from '../lib/frontier/editorialClip';
import type { FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: 'clip-signal',
    title: 'A new method for decoding latent neural state',
    summary: 'The method improves cross-subject transfer by 18% while preserving calibration on held-out participants.',
    url: 'https://example.com/story',
    source: 'example.com',
    sourceLabel: 'Example Journal',
    sourceKind: 'openalex',
    publishedAt: '2026-08-21T00:00:00.000Z',
    lane: 'neuro_frontier',
    tags: ['neural decoding'],
    baseScore: 0.7,
    importance: 0.7,
    novelty: 0.6,
    quality: 0.9,
    momentum: 0.5,
    ...overrides,
  };
}

test('topic families map to restrained editorial variants', () => {
  assert.equal(editorialClipVariant(item()), 'research');
  assert.equal(editorialClipVariant(item({ sourceKind: 'github', lane: 'builder_signal' })), 'builder');
  assert.equal(editorialClipVariant(item({ sourceKind: 'rss', lane: 'sports' })), 'sport');
  assert.equal(editorialClipVariant(item({ sourceKind: 'steam', lane: 'gaming' })), 'games');
  assert.equal(editorialClipVariant(item({ sourceKind: 'rss', lane: 'music' })), 'music');
  assert.equal(editorialClipVariant(item({ sourceKind: 'reddit', lane: 'internet_culture' })), 'culture');
});

test('real quoted source text is preserved as the clipping highlight', () => {
  const signal = item({
    summary: 'The authors write, “The representation stays stable even when the subject changes.” Additional analysis follows.',
  });
  const clip = deriveEditorialClip(signal);
  assert.equal(clip.kind, 'quote');
  assert.equal(clip.highlight, 'The representation stays stable even when the subject changes.');
  assert.ok(signal.summary.includes(clip.highlight));
});

test('meaningful summaries produce source-backed excerpts rather than invented copy', () => {
  const signal = item({
    summary: 'Early baselines were competitive. The new model improves transfer by 18% while using fewer calibration trials. The authors also report stable uncertainty estimates.',
  });
  const clip = deriveEditorialClip(signal);
  assert.equal(clip.kind, 'excerpt');
  assert.ok(signal.summary.includes(clip.highlight.replace(/…$/, '')));
  assert.match(clip.highlight, /18%/);
});

test('utility boilerplate falls back to a phrase cut from the real title', () => {
  const signal = item({
    sourceKind: 'hackernews',
    lane: 'wildcards',
    title: 'A long outage postmortem: why the recovery path failed under load',
    summary: '471 points · 539 comments. Community momentum is a discovery signal, not a proxy for truth.',
  });
  const clip = deriveEditorialClip(signal);
  assert.equal(clip.kind, 'headline');
  assert.equal(clip.highlight, 'why the recovery path failed under load');
  assert.ok(signal.title.includes(clip.highlight));
});

test('long excerpts remain bounded and never fabricate a replacement sentence', () => {
  const sentence = 'This source-backed sentence contains a detailed explanation of the result, the intervention, the observed effect, the practical limitation, and the follow-up analysis that makes the story useful for a reader deciding whether to open the original source.';
  const signal = item({ summary: sentence });
  const clip = deriveEditorialClip(signal);
  const unellipsized = clip.highlight.replace(/…$/, '');
  assert.ok(clip.highlight.length <= 187);
  assert.ok(sentence.startsWith(unellipsized));
});

test('author metadata can become a compact byline without changing the source text', () => {
  const clip = deriveEditorialClip(item({ authors: ['Ada Example', 'Lin Example', 'Third Author'] }));
  assert.equal(clip.byline, 'Ada Example, Lin Example');
});
