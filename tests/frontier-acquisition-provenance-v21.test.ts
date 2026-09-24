import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierAcquisitionFromQuery,
  mergeFrontierAcquisition,
} from '../lib/frontier/acquisitionProvenance';
import {
  assessFrontierCandidateEvidence,
  candidateEvidenceShadowAdjustment,
} from '../lib/frontier/candidateEvidence';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { parsePrivateFrontierState } from '../lib/frontier/frontierArchiveStateValidation';
import {
  dedupeFrontierLiveItems,
  parseAdaptiveOpenAlexWorks,
} from '../lib/frontier/liveDiscovery';
import { buildOpenAlexItemsFromSearchPayloads } from '../lib/frontier/sources';
import type { FrontierItem, FrontierPersistedState } from '../lib/frontier/types';

const ISO = '2026-09-01T12:00:00.000Z';

function paper(id = 'paper'): FrontierItem {
  return {
    id,
    title: 'Neural decoding with causal representation learning',
    summary: 'Neural decoding and causal inference for held-out brain computer interface data.',
    url: `https://example.org/${id}`,
    source: 'Example Journal',
    sourceLabel: 'Example Journal',
    sourceKind: 'openalex',
    publishedAt: ISO,
    lane: 'neuro_frontier',
    tags: ['neural decoding', 'brain computer interface'],
    metrics: [{ label: 'citations', value: '0' }],
    baseScore: 0.72,
    importance: 0.7,
    novelty: 0.75,
    quality: 0.85,
    momentum: 0.4,
  };
}

function stateWith(item: FrontierItem): FrontierPersistedState {
  return {
    version: 4,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: { [item.id]: item },
    collections: [{ id: 'inbox', name: 'Inbox', itemIds: [item.id], createdAt: ISO }],
    history: {
      [item.id]: {
        item,
        firstSeenAt: ISO,
        lastSeenAt: ISO,
        impressions: 1,
        resurfacedCount: 0,
        rewarded: false,
      },
    },
    game: { xp: 0, streak: 0, completedQuestDays: {} },
  };
}

const openAlexWork = {
  id: 'https://openalex.org/W123',
  title: 'Neural decoding with causal representation learning',
  publication_date: '2026-09-01',
  cited_by_count: 0,
  primary_location: {
    landing_page_url: 'https://example.org/work/W123',
    source: { display_name: 'Example Journal' },
  },
  topics: [
    { display_name: 'Neural Decoding', score: 0.99 },
    { display_name: 'Brain Computer Interface', score: 0.9 },
  ],
};

test('static OpenAlex preserves every query that actually returned the same work', () => {
  const items = buildOpenAlexItemsFromSearchPayloads([
    { query: 'neural decoding brain computer interface neuroai', results: [openAlexWork] },
    { query: 'machine learning data analysis causal inference', results: [openAlexWork] },
  ]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].acquisition?.queries, [
    { kind: 'openalex-static-search', query: 'machine learning data analysis causal inference' },
    { kind: 'openalex-static-search', query: 'neural decoding brain computer interface neuroai' },
  ]);
});

test('adaptive OpenAlex records the exact normalized topic query', () => {
  const [item] = parseAdaptiveOpenAlexWorks([openAlexWork], '  neural   decoding  ');
  assert.deepEqual(item.acquisition, {
    queries: [{ kind: 'openalex-adaptive-search', query: 'neural decoding' }],
  });
});

test('live dedupe unions query provenance instead of letting first result win', () => {
  const first = paper('same');
  first.url = 'https://example.org/shared?utm=one';
  first.acquisition = frontierAcquisitionFromQuery('openalex-static-search', 'neural decoding');
  const second = { ...paper('same-2'), url: 'https://example.org/shared#paper' };
  second.acquisition = frontierAcquisitionFromQuery('openalex-adaptive-search', 'brain computer interface');

  const mergedItems = dedupeFrontierLiveItems([first, second]);
  assert.equal(mergedItems.length, 1);
  assert.deepEqual(mergedItems[0].acquisition?.queries, [
    { kind: 'openalex-adaptive-search', query: 'brain computer interface' },
    { kind: 'openalex-static-search', query: 'neural decoding' },
  ]);
});

test('provenance union is canonical and duplicate-safe', () => {
  const a = frontierAcquisitionFromQuery('openalex-static-search', '  Neural   Decoding ');
  const b = frontierAcquisitionFromQuery('openalex-static-search', 'neural decoding');
  const c = frontierAcquisitionFromQuery('openalex-adaptive-search', 'neural decoding');
  assert.deepEqual(mergeFrontierAcquisition(a, b, c), {
    queries: [
      { kind: 'openalex-adaptive-search', query: 'neural decoding' },
      { kind: 'openalex-static-search', query: 'Neural Decoding' },
    ],
  });
});

test('strict private archive accepts canonical provenance and remains backward compatible', () => {
  const withProvenance = paper();
  withProvenance.acquisition = frontierAcquisitionFromQuery('openalex-static-search', 'neural decoding');
  const parsed = parsePrivateFrontierState(stateWith(withProvenance));
  assert.ok(parsed);
  assert.deepEqual(parsed.saved[withProvenance.id].acquisition, withProvenance.acquisition);

  const legacy = paper('legacy');
  assert.ok(parsePrivateFrontierState(stateWith(legacy)));
});

test('strict private archive rejects noncanonical, duplicate, and authority-shaped provenance', () => {
  const base = stateWith(paper()) as unknown as Record<string, unknown>;
  const saved = base.saved as Record<string, Record<string, unknown>>;

  saved.paper.acquisition = {
    queries: [{ kind: 'openalex-static-search', query: ' neural  decoding ' }],
  };
  assert.equal(parsePrivateFrontierState(base), null);

  saved.paper.acquisition = {
    queries: [
      { kind: 'openalex-static-search', query: 'neural decoding' },
      { kind: 'openalex-static-search', query: 'Neural Decoding' },
    ],
  };
  assert.equal(parsePrivateFrontierState(base), null);

  saved.paper.acquisition = {
    queries: [{ kind: 'openalex-static-search', query: 'neural decoding', score: 0.9 }],
  };
  assert.equal(parsePrivateFrontierState(base), null);
});

test('strict private archive rejects OpenAlex query provenance on non-OpenAlex items', () => {
  const github = paper('cross-source');
  github.sourceKind = 'github';
  github.source = 'github.com';
  github.sourceLabel = 'GitHub';
  github.url = 'https://github.com/example/cross-source';
  github.acquisition = frontierAcquisitionFromQuery('openalex-static-search', 'neural decoding');
  assert.equal(parsePrivateFrontierState(stateWith(github)), null);
});

test('attaching provenance alone has zero candidate-evidence authority', () => {
  const base = paper('authority');
  const annotated: FrontierItem = {
    ...base,
    acquisition: frontierAcquisitionFromQuery(
      'openalex-static-search',
      'completely unrelated acquisition metadata',
    ),
  };

  assert.deepEqual(assessFrontierCandidateEvidence(annotated), assessFrontierCandidateEvidence(base));
  assert.equal(candidateEvidenceShadowAdjustment(annotated), candidateEvidenceShadowAdjustment(base));
});
