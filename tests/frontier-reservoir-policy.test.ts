import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_RESERVOIR_MIN_VALIDATION,
  frontierReservoirEligible,
  frontierReservoirShelfLifeMs,
  frontierReservoirValidationScore,
  sampleFrontierReservoirForDay,
  type FrontierReservoirCandidate,
} from '../lib/frontier/recommendation/reservoirPolicy';
import type { FrontierItem, FrontierLaneId } from '../lib/frontier/types';

const DAY_MS = 86_400_000;

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://huggingface.co/papers/${id}`,
    source: 'huggingface.co',
    sourceLabel: 'Hugging Face Papers',
    sourceKind: 'huggingface',
    publishedAt: '2026-08-25T12:00:00.000Z',
    lane: 'ai_frontier',
    tags: ['research', 'world model'],
    baseScore: 0.76,
    importance: 0.72,
    novelty: 0.78,
    quality: 0.9,
    momentum: 0.62,
    ...overrides,
  };
}

function record(entry: FrontierItem, discoveredAt: number, index = 0): FrontierReservoirCandidate {
  return {
    key: `${entry.id}-${index}`,
    item: entry,
    discoveredAt,
    validationScore: frontierReservoirValidationScore(entry),
    lastOfferedAt: 0,
    offerCount: 0,
  };
}

test('Game2World-shaped Hugging Face research remains a durable validated candidate', () => {
  const game2world = item('2608.24680', {
    title: 'Game2World Engine: Unlocking In-the-Wild Gameplay Videos for World Model Training',
    summary: 'Gameplay UI removal, paired video data, and world-model training.',
    tags: ['video world models', 'gameplay video', 'multimodal learning', 'game data engine'],
  });
  const published = new Date(game2world.publishedAt).getTime();

  assert.equal(frontierReservoirShelfLifeMs(game2world), 45 * DAY_MS);
  assert.ok(frontierReservoirValidationScore(game2world) >= FRONTIER_RESERVOIR_MIN_VALIDATION);
  assert.equal(frontierReservoirEligible(game2world, published, published + 21 * DAY_MS), true);
  assert.equal(frontierReservoirEligible(game2world, published, published + 46 * DAY_MS), false);
});

test('ephemeral live state expires aggressively while durable research survives', () => {
  const now = Date.parse('2026-08-26T18:00:00.000Z');
  const live = item('live-score', {
    sourceKind: 'sports_state',
    source: 'nfl.com',
    sourceLabel: 'NFL',
    url: 'https://www.nfl.com/games/example',
    lane: 'sports',
    tags: ['sports state'],
    publishedAt: new Date(now - 19 * 60 * 60_000).toISOString(),
  });
  const paper = item('paper-old', {
    publishedAt: new Date(now - 20 * DAY_MS).toISOString(),
  });

  assert.equal(frontierReservoirShelfLifeMs(live), 18 * 60 * 60_000);
  assert.equal(frontierReservoirEligible(live, now - 19 * 60 * 60_000, now), false);
  assert.equal(frontierReservoirEligible(paper, now - 20 * DAY_MS, now), true);
});

test('weak community material cannot become durable merely because it was fetched', () => {
  const weak = item('weak-social', {
    sourceKind: 'reddit',
    source: 'reddit.com',
    sourceLabel: 'Reddit',
    url: 'https://www.reddit.com/r/example/comments/test',
    lane: 'internet_culture',
    quality: 0.25,
    importance: 0.2,
    baseScore: 0.28,
    novelty: 0.5,
    momentum: 0.3,
  });
  assert.ok(frontierReservoirValidationScore(weak) < FRONTIER_RESERVOIR_MIN_VALIDATION);
});

test('daily reservoir sampling is stable within a day but rotates across days', () => {
  const now = Date.parse('2026-08-26T18:00:00.000Z');
  const lanes: FrontierLaneId[] = ['ai_frontier', 'neuro_frontier', 'broad_science', 'methods', 'builder_signal', 'gaming'];
  const records = Array.from({ length: 72 }, (_, index) => record(item(`stable-${index}`, {
    lane: lanes[index % lanes.length],
    sourceKind: index % 6 === 4 ? 'github' : 'huggingface',
    source: `source-${index}.example`,
    url: index % 6 === 4
      ? `https://github.com/example/project-${index}`
      : `https://huggingface.co/papers/stable-${index}`,
    publishedAt: new Date(now - (index % 8) * 60 * 60_000).toISOString(),
  }), now - (index % 8) * 60 * 60_000, index));

  const first = sampleFrontierReservoirForDay(records, 36, now).map((entry) => entry.key);
  const second = sampleFrontierReservoirForDay(records, 36, now + 2 * 60 * 60_000).map((entry) => entry.key);
  const nextDay = sampleFrontierReservoirForDay(records, 36, now + DAY_MS).map((entry) => entry.key);

  assert.deepEqual(second, first, 'same-day reservoir replay should not reshuffle');
  assert.notDeepEqual(nextDay, first, 'next day should expose a different bounded random cross-section');
});

test('daily reservoir cross-section preserves lane and publisher diversity when supply exists', () => {
  const now = Date.parse('2026-08-26T18:00:00.000Z');
  const lanes: FrontierLaneId[] = ['ai_frontier', 'neuro_frontier', 'broad_science', 'methods', 'builder_signal', 'gaming', 'music', 'sports'];
  const records = Array.from({ length: 128 }, (_, index) => {
    const lane = lanes[index % lanes.length];
    const entry = item(`diverse-${index}`, {
      lane,
      source: `publisher-${index}.example`,
      url: `https://publisher-${index}.example/story`,
      sourceKind: lane === 'gaming' ? 'steam' : lane === 'sports' ? 'github' : 'huggingface',
      publishedAt: new Date(now - (index % 12) * 60 * 60_000).toISOString(),
    });
    return record(entry, now - (index % 12) * 60 * 60_000, index);
  });

  const selected = sampleFrontierReservoirForDay(records, 64, now);
  const laneCounts = new Map<string, number>();
  for (const candidate of selected) laneCounts.set(candidate.item.lane, (laneCounts.get(candidate.item.lane) ?? 0) + 1);

  assert.equal(selected.length, 64);
  assert.ok(new Set(selected.map((candidate) => candidate.item.lane)).size >= 7);
  assert.ok(Math.max(...laneCounts.values()) <= Math.ceil(64 * 0.2));
});
