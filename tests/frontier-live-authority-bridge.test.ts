import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import {
  auditFrontierDailyRunTasteAuthority,
  frontierDailyRunProductionProjection,
} from '../lib/frontier/dailyRunTasteAuthorityAudit';
import { buildFrontierLiveAuthorityBridge } from '../lib/frontier/liveAuthorityBridge';
import { auditFrontierRankAuthority } from '../lib/frontier/rankAuthorityAudit';
import { selectDailyRun } from '../lib/frontier/scoring';
import type { FrontierItem, FrontierLaneId, FrontierSourceKind } from '../lib/frontier/types';

const NOW = new Date('2026-08-31T07:00:00.000Z');

function item(input: {
  id: string;
  title: string;
  lane: FrontierLaneId;
  sourceKind: FrontierSourceKind;
  tags: string[];
  baseScore: number;
}): FrontierItem {
  return {
    id: input.id,
    title: input.title,
    summary: `Summary for ${input.title}`,
    url: `https://example.org/${input.id}`,
    source: input.sourceKind,
    sourceLabel: input.sourceKind,
    sourceKind: input.sourceKind,
    publishedAt: '2026-08-31T06:00:00.000Z',
    lane: input.lane,
    tags: input.tags,
    baseScore: input.baseScore,
    importance: 0.72,
    novelty: 0.68,
    quality: 0.78,
    momentum: 0.42,
  };
}

const REALM_RANKED: FrontierItem[] = [
  item({
    id: 'neuro-a',
    title: 'BCI decoding benchmark',
    lane: 'neuro_frontier',
    sourceKind: 'openalex',
    tags: ['brain computer interface', 'neuroscience'],
    baseScore: 0.94,
  }),
  item({
    id: 'builder-b',
    title: 'Agent observability toolkit',
    lane: 'builder_signal',
    sourceKind: 'github',
    tags: ['agent systems', 'developer tools'],
    baseScore: 0.88,
  }),
  item({
    id: 'science-c',
    title: 'Scientific visualization methods',
    lane: 'broad_science',
    sourceKind: 'arxiv',
    tags: ['scientific visualization', 'methods'],
    baseScore: 0.84,
  }),
  item({
    id: 'game-d',
    title: 'Indie game systems design',
    lane: 'gaming',
    sourceKind: 'rss',
    tags: ['games', 'systems design'],
    baseScore: 0.76,
  }),
];

function broadRanked(count = 64): FrontierItem[] {
  const lanes: FrontierLaneId[] = [
    'must_know',
    'neuro_frontier',
    'builder_signal',
    'broad_science',
    'sports',
    'gaming',
    'screen',
    'music',
  ];
  const sources: FrontierSourceKind[] = [
    'rss',
    'openalex',
    'github',
    'arxiv',
    'reddit',
    'steam',
    'youtube',
    'hackernews',
  ];
  return Array.from({ length: count }, (_, index) => item({
    id: `candidate-${index}`,
    title: `Candidate ${index}`,
    lane: lanes[index % lanes.length]!,
    sourceKind: sources[index % sources.length]!,
    tags: [`topic-${index % 11}`, `facet-${index % 5}`],
    baseScore: Math.max(0.05, 0.98 - index * 0.01),
  }));
}

test('live bridge delegates to qualified rank audit and composite daily-run audit on one cohort', () => {
  const profile = createInitialProfile();
  const behavior = createInitialBehaviorModel();
  const history = {};
  const limit = 3;

  const bridge = buildFrontierLiveAuthorityBridge({
    realmRanked: REALM_RANKED,
    profile,
    history,
    behavior,
    limit,
    now: NOW,
  });

  assert.deepEqual(
    bridge.rankAuthority,
    auditFrontierRankAuthority(REALM_RANKED, profile, history, limit, NOW, behavior),
  );
  assert.deepEqual(
    bridge.slateTasteAuthority,
    auditFrontierDailyRunTasteAuthority(REALM_RANKED, limit),
  );
  assert.equal(bridge.candidates, REALM_RANKED.length);
  assert.equal(bridge.limit, limit);
});

test('diagnostic production projection stays membership-identical to selectDailyRun', () => {
  const ranked = broadRanked();
  for (const limit of [0, 1, 8, 14, 15, 24, 48, 64]) {
    assert.deepEqual(
      frontierDailyRunProductionProjection(ranked, limit).map((candidate) => candidate.id),
      selectDailyRun(ranked, {}, limit, NOW).map((candidate) => candidate.id),
      `daily-run projection drifted at limit ${limit}`,
    );
  }
});

test('live bridge returns aggregates only and leaks no candidate identity or content', () => {
  const bridge = buildFrontierLiveAuthorityBridge({
    realmRanked: REALM_RANKED,
    profile: createInitialProfile(),
    history: {},
    behavior: createInitialBehaviorModel(),
    limit: 3,
    now: NOW,
  });
  const serialized = JSON.stringify(bridge);

  for (const candidate of REALM_RANKED) {
    assert.equal(serialized.includes(candidate.id), false);
    assert.equal(serialized.includes(candidate.title), false);
    assert.equal(serialized.includes(candidate.summary), false);
    assert.equal(serialized.includes(candidate.url), false);
  }
});

test('live bridge uses the production limit without inventing candidates', () => {
  const bridge = buildFrontierLiveAuthorityBridge({
    realmRanked: REALM_RANKED.slice(0, 2),
    profile: createInitialProfile(),
    history: {},
    behavior: createInitialBehaviorModel(),
    limit: 48,
    now: NOW,
  });

  assert.equal(bridge.limit, 48);
  assert.equal(bridge.candidates, 2);
  assert.equal(bridge.rankAuthority.topK, 2);
  assert.equal(bridge.slateTasteAuthority.limit, 48);
  assert.equal(bridge.slateTasteAuthority.canonicalLimit, 14);
  assert.ok(bridge.slateTasteAuthority.productionSelected <= 2);
  assert.ok(bridge.slateTasteAuthority.disabledSelected <= 2);
});
