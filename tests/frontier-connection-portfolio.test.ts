import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConnectionExposureIndex,
  connectionPortfolioAdjustment,
  interestConnectionSignatures,
} from '../lib/frontier/connectionPortfolio';
import { personalInterestConnection } from '../lib/frontier/interestGraph';
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
  assert.ok(signatures.some(({ key, weight }) => key.includes('domain:motion-sports') && key.includes('facet:motion-science') && weight < 0.3));
});

test('climbing, MTB, and skiing retain distinct graph identities inside the shared motion-sports domain', () => {
  const climbing = personalInterestConnection(item({
    id: 'climb',
    title: 'Rock climbing biomechanics toolkit',
    summary: 'Open-source pose estimation for bouldering movement analysis.',
    tags: ['rock climbing', 'bouldering', 'biomechanics', 'pose estimation', 'open source'],
  }));
  const mtb = personalInterestConnection(item({
    id: 'mtb',
    title: 'Mountain biking trail telemetry dashboard',
    summary: 'Open-source GPX and IMU analysis for MTB ride data.',
    tags: ['mountain biking', 'mtb', 'telemetry', 'gpx', 'open source'],
  }));
  const skiing = personalInterestConnection(item({
    id: 'ski',
    title: 'Skiing motion analysis',
    summary: 'Wearable sensor analysis for freeski technique.',
    tags: ['skiing', 'freeski', 'wearable data', 'analysis'],
  }));

  assert.ok(climbing.topicIds.includes('rock-climbing'));
  assert.ok(mtb.topicIds.includes('mountain-biking'));
  assert.ok(skiing.topicIds.includes('skiing'));
  assert.ok(climbing.domains.includes('motion-sports'));
  assert.ok(mtb.domains.includes('motion-sports'));
  assert.ok(skiing.domains.includes('motion-sports'));

  // Method-rich hobby items may correctly span science-engineering too. The
  // contract is identity precision, not artificially forcing one domain label.
  assert.ok(climbing.domains.includes('science-engineering'));

  const climbingKeys = new Set(interestConnectionSignatures(item({
    id: 'climb-signature',
    title: 'Rock climbing biomechanics toolkit',
    summary: 'Pose estimation for bouldering movement analysis.',
    tags: ['rock climbing', 'bouldering', 'biomechanics', 'pose estimation'],
  })).map(({ key }) => key));
  const mtbKeys = new Set(interestConnectionSignatures(item({
    id: 'mtb-signature',
    title: 'Mountain biking telemetry toolkit',
    summary: 'GPX and IMU analysis for MTB rides.',
    tags: ['mountain biking', 'mtb', 'telemetry', 'gpx'],
  })).map(({ key }) => key));

  assert.ok(Array.from(climbingKeys).some((key) => key.includes('topic:rock-climbing')));
  assert.ok(Array.from(mtbKeys).some((key) => key.includes('topic:mountain-biking')));
  assert.equal(Array.from(climbingKeys).some((key) => key.includes('topic:mountain-biking')), false);
});

test('recent repetition taxes the exact bridge far more than a fresh neighboring bridge', () => {
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
  assert.ok(fresh.exposure < repeated.exposure * 0.4);
  assert.ok(fresh.penalty < repeated.penalty * 0.25);
  assert.ok(fresh.net > repeated.net);
});

test('learned negative pair evidence vetoes a fresh-bridge exploration bonus', () => {
  const candidate = item({ id: 'rejected-bridge' });
  const neutral = connectionPortfolioAdjustment(candidate, new Map(), 0);
  const rejected = connectionPortfolioAdjustment(candidate, new Map(), -0.3);

  assert.ok(neutral.bonus > 0);
  assert.equal(rejected.bonus, 0);
  assert.equal(rejected.net, 0);
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
