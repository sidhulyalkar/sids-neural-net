import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichFrontierSemantics,
  frontierCandidatePriority,
  requestTimeEnglishItems,
} from '../lib/frontier/aggregate';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'local',
    publishedAt: '2026-08-23T12:00:00.000Z',
    lane: 'ai_frontier',
    tags: [],
    baseScore: 0.8,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.7,
    momentum: 0.5,
    ...overrides,
  };
}

test('semantic enrichment recognizes taste concepts before candidate truncation', () => {
  const raw = item('viz', {
    title: 'Neuroglancer volume rendering for a connectomics atlas',
    lane: 'neuro_frontier',
  });
  const enriched = enrichFrontierSemantics(raw);
  assert.ok(enriched.tags.includes('scientific visualization'));
  assert.ok(enriched.tags.includes('neuroglancer'));
});

test('publisher identity can never manufacture personal topic meaning', () => {
  const publisherOnly = enrichFrontierSemantics(item('publisher-only', {
    title: 'Quarterly corporate scheduling update',
    summary: 'A routine company operations notice with no entertainment subject matter.',
    source: 'crunchyroll.com',
    sourceLabel: 'Crunchyroll News',
    sourceKind: 'rss',
    lane: 'world_pulse',
  }));

  assert.equal(publisherOnly.tags.includes('screen orbit'), false);
  assert.equal(publisherOnly.tags.includes('anime'), false);
});

test('bounded candidate prior can preserve a high-fit sports signal over slightly higher generic AI inventory', () => {
  const generic = enrichFrontierSemantics(item('generic', {
    title: 'General purpose language model release',
    lane: 'ai_frontier',
    tags: ['language model', 'release'],
    baseScore: 0.83,
  }));
  const nfl = enrichFrontierSemantics(item('nfl', {
    title: 'NFL player tracking model combines EPA and CPOE',
    lane: 'sports',
    tags: ['nfl', 'player tracking', 'sports analytics'],
    baseScore: 0.77,
  }));

  assert.ok(frontierCandidatePriority(nfl) > frontierCandidatePriority(generic));
});

test('request-time bootstrap never waits on translation-only candidates', () => {
  const english = item('english', {
    title: 'NFL route participation model update',
    summary: 'A useful English-language analysis item.',
    lane: 'sports',
  });
  const foreign = item('foreign', {
    title: 'Nuevo modelo para análisis de fútbol',
    summary: 'Una nueva herramienta para datos deportivos y visualización.',
    lane: 'sports',
  });

  assert.deepEqual(requestTimeEnglishItems([foreign, english]).map((entry) => entry.id), ['english']);
});
