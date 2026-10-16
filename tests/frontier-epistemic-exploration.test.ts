import assert from 'node:assert/strict';
import test from 'node:test';
import { connectionPortfolioAdjustment } from '../lib/frontier/connectionPortfolio';
import type { FrontierItem } from '../lib/frontier/types';

function candidate(): FrontierItem {
  return {
    id: 'disc-sim',
    title: 'Disc golf flight simulation toolkit',
    summary: 'Open-source physics and trajectory simulation for disc flight analysis.',
    url: 'https://github.com/example/disc-flight',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-29T20:00:00.000Z',
    lane: 'sports',
    tags: ['disc golf', 'simulation', 'open source', 'analysis'],
    baseScore: 0.7,
    importance: 0.58,
    novelty: 0.75,
    quality: 0.8,
    momentum: 0.5,
  };
}

test('fresh bridge exploration is strongest when preference evidence is still uncertain', () => {
  const uncertain = connectionPortfolioAdjustment(candidate(), new Map(), 0.04, 0.08);
  const partiallyKnown = connectionPortfolioAdjustment(candidate(), new Map(), 0.32, 0.42);
  const wellKnown = connectionPortfolioAdjustment(candidate(), new Map(), 0.55, 0.8);

  assert.ok(uncertain.bonus > 0);
  assert.ok(partiallyKnown.bonus > 0);
  assert.ok(uncertain.bonus > partiallyKnown.bonus);
  assert.equal(wellKnown.bonus, 0);
});

test('negative evidence vetoes epistemic exploration regardless of uncertainty', () => {
  const rejected = connectionPortfolioAdjustment(candidate(), new Map(), -0.24, 0.12);
  assert.equal(rejected.bonus, 0);
  assert.equal(rejected.net, 0);
});

test('important signals are never distorted to satisfy an exploration experiment', () => {
  const important = { ...candidate(), id: 'important', importance: 0.92 };
  const result = connectionPortfolioAdjustment(important, new Map(), 0, 0);
  assert.equal(result.bonus, 0);
  assert.equal(result.penalty, 0);
});
