import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { buildDiscoveryFocus } from '../lib/frontier/discoveryFocus';
import {
  FRONTIER_DISCOVERY_SEEDS,
  matchesPersonalTasteTopic,
  personalTasteRankingPrior,
  personalTasteTags,
} from '../lib/frontier/personalTaste';
import { personalizedScore, selectDailyRun } from '../lib/frontier/scoring';
import type { FrontierItem, FrontierProfile } from '../lib/frontier/types';

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
    lane: 'ml_data',
    tags: [],
    baseScore: 0.68,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.7,
    momentum: 0.55,
    ...overrides,
  };
}

test('explicit taste map recognizes NFL/fantasy, Neuroglancer, and neuroscience tooling', () => {
  const tags = personalTasteTags('Neuroglancer + napari viewer for connectomics with DataJoint and Neuropixels data');
  assert.ok(tags.includes('scientific visualization'));
  assert.ok(tags.includes('neuroscience'));

  const fantasy = item('fantasy', {
    title: '2QB superflex ADP shifts from route participation and target share',
    lane: 'sports',
    tags: ['fantasy football', '2qb', 'superflex'],
  });
  const neuroglancer = item('neuroglancer', {
    title: 'Neuroglancer volume rendering for a new connectomics atlas',
    lane: 'neuro_frontier',
    tags: ['neuroglancer', 'scientific visualization'],
  });

  assert.equal(matchesPersonalTasteTopic(fantasy, ['fantasy-football']), true);
  assert.ok(personalTasteRankingPrior(fantasy) >= 0.16);
  assert.equal(matchesPersonalTasteTopic(neuroglancer, ['scientific-visualization']), true);
  assert.ok(personalTasteRankingPrior(neuroglancer) >= 0.16);
});

test('personal taste prior beats otherwise-comparable generic AI during cold start', () => {
  const profile = createInitialProfile();
  const now = new Date('2026-08-23T20:00:00.000Z');
  const nfl = item('nfl-model', {
    title: 'NFL player tracking model combines EPA, CPOE, and play-by-play state',
    lane: 'sports',
    tags: ['nfl', 'sports analytics', 'player tracking'],
  });
  const genericAi = item('generic-ai', {
    title: 'A new general-purpose language model release',
    lane: 'ai_frontier',
    tags: ['language model', 'release'],
  });

  assert.ok(personalTasteRankingPrior(genericAi) < 0);
  assert.ok(personalizedScore(nfl, profile, undefined, now) > personalizedScore(genericAi, profile, undefined, now));
});

test('learned negative preferences can suppress the explicit seed prior', () => {
  const base = createInitialProfile();
  const fantasy = item('fantasy-veto', {
    title: 'Fantasy football superflex projection model and ADP update',
    lane: 'sports',
    tags: ['fantasy football', 'superflex', '2qb'],
  });
  const now = new Date('2026-08-23T20:00:00.000Z');
  const disliked: FrontierProfile = {
    ...base,
    laneAffinity: { ...base.laneAffinity, sports: -0.35 },
    topicAffinity: { ...base.topicAffinity, 'fantasy football': -0.5, superflex: -0.45, '2qb': -0.45 },
  };

  const seeded = personalizedScore(fantasy, base, undefined, now);
  const suppressed = personalizedScore(fantasy, disliked, undefined, now);
  assert.ok(suppressed < seeded - 0.08);
});

test('daily run reserves semantic slots for sports data, visualization tools, and watchable taste signals', () => {
  const generic = Array.from({ length: 14 }, (_, index) => item(`generic-${index}`, {
    lane: index % 2 ? 'ai_frontier' : 'ml_data',
    title: `Generic signal ${index}`,
    tags: ['generic'],
    importance: index === 0 ? 0.9 : 0.58,
  }));
  const sportsData = item('sports-data', {
    title: 'nflverse player tracking EPA visualization',
    lane: 'sports',
    tags: ['nfl', 'sports analytics', 'player tracking'],
  });
  const visualization = item('visualization', {
    title: 'Neuroglancer and napari connectomics viewer release',
    lane: 'neuro_frontier',
    tags: ['neuroglancer', 'scientific visualization'],
  });
  const watchable = item('watchable', {
    title: 'WebGPU procedural graphics demo',
    lane: 'internet_culture',
    sourceKind: 'youtube',
    url: 'https://www.youtube.com/watch?v=abc123xyz00',
    source: 'youtube.com',
    sourceLabel: 'YouTube',
    tags: ['webgpu', 'game design', 'watchable', 'video'],
  });

  const run = selectDailyRun([...generic, sportsData, visualization, watchable], {}, 14, new Date('2026-08-23T20:00:00.000Z'));
  const ids = new Set(run.map((entry) => entry.id));
  assert.ok(ids.has('sports-data'));
  assert.ok(ids.has('visualization'));
  assert.ok(ids.has('watchable'));
});

test('adaptive discovery keeps explicit taste seeds in sparse profiles', () => {
  const profile = createInitialProfile();
  profile.topicAffinity = {};
  profile.knownTopics = {};
  profile.meaningfulInteractions = 0;

  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-23T12:00:00.000Z'));
  const seedSet = new Set(FRONTIER_DISCOVERY_SEEDS.map((seed) => seed.toLowerCase()));
  assert.equal(focus.length, 7);
  assert.ok(focus.filter((topic) => seedSet.has(topic)).length >= 3);
});
