import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConnectionExposureIndex,
  connectionPortfolioAdjustment,
  interestConnectionSignatures,
} from '../lib/frontier/connectionPortfolio';
import type { FrontierHistoryEntry, FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: overrides.id ?? 'skate-pose',
    title: 'Street skating pose estimation toolkit',
    summary: 'Open-source biomechanics and computer vision analysis for trick progression.',
    url: 'https://github.com/example/skate-motion',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-29T12:00:00.000Z',
    lane: 'sports',
    tags: ['street skating', 'skateboarding', 'pose estimation', 'open source'],
    baseScore: 0.68,
    importance: 0.58,
    novelty: 0.72,
    quality: 0.76,
    momentum: 0.55,
    ...overrides,
  };
}

function historyEntry(source: FrontierItem, lastSeenAt: string, impressions = 2): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: lastSeenAt,
    lastSeenAt,
    impressions,
    resurfacedCount: 0,
    rewarded: false,
  };
}

test('connection signatures preserve exact topic-method edges and weaker transferable domain edges', () => {
  const signatures = interestConnectionSignatures(item());
  assert.ok(signatures.some(({ key, weight }) => key.includes('topic:skate-progression') && key.includes('facet:motion-science') && weight === 1));
  assert.ok(signatures.some(({ key, weight }) => key.includes('domain:motion-sports') && key.includes('facet:motion-science') && weight < 1));
});

test('recent repetition progressively taxes the same bridge while a fresh bridge earns exploration room', () => {
  const now = new Date('2026-08-29T18:00:00.000Z');
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < 4; index += 1) {
    const seen = item({
      id: `seen-${index}`,
      url: `https://github.com/example/skate-motion-${index}`,
    });
    history[seen.id] = historyEntry(seen, new Date(now.getTime() - index * 8 * 60 * 60 * 1000).toISOString(), 2);
  }

  const exposure = buildConnectionExposureIndex(history, now);
  const repeated = connectionPortfolioAdjustment(item({ id: 'new-skate' }), exposure);
  const fresh = connectionPortfolioAdjustment(item({
    id: 'disc-sim',
    title: 'Disc golf flight simulation toolkit',
    summary: 'Open-source physics and trajectory simulation for disc flight.',
    url: 'https://github.com/example/disc-flight',
    tags: ['disc golf', 'simulation', 'open source'],
  }), exposure);

  assert.ok(repeated.exposure > 0.8);
  assert.ok(repeated.penalty > 0);
  assert.ok(repeated.net < 0);
  assert.equal(fresh.penalty, 0);
  assert.ok(fresh.bonus > 0);
  assert.ok(fresh.net > repeated.net);
});

test('connection saturation decays instead of becoming a permanent preference penalty', () => {
  const now = new Date('2026-08-29T18:00:00.000Z');
  const old = item({ id: 'old-skate' });
  const history = {
    [old.id]: historyEntry(old, '2026-07-01T18:00:00.000Z', 6),
  };
  const exposure = buildConnectionExposureIndex(history, now);
  const adjustment = connectionPortfolioAdjustment(item({ id: 'returning-skate' }), exposure);
  assert.ok(adjustment.exposure < 0.05);
  assert.equal(adjustment.penalty, 0);
});

test('important or watched signals are never suppressed by connection fatigue', () => {
  const now = new Date('2026-08-29T18:00:00.000Z');
  const seen = item({ id: 'seen' });
  const history = {
    [seen.id]: historyEntry(seen, now.toISOString(), 8),
  };
  const exposure = buildConnectionExposureIndex(history, now);
  const critical = connectionPortfolioAdjustment(item({ id: 'critical', importance: 0.91 }), exposure);
  assert.ok(critical.exposure > 0.8);
  assert.equal(critical.penalty, 0);
  assert.equal(critical.net, 0);
});
