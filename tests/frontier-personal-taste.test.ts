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

test('short analytical aliases require token boundaries instead of matching inside ordinary words', () => {
  const falsePositive = item('separation-paper', {
    title: 'Adaptive separation methods for long-horizon world models',
    summary: 'A reinforcement-learning paper about representation quality and remasking.',
    lane: 'ai_frontier',
  });
  const realEpa = item('real-epa', {
    title: 'NFL EPA model improves fourth-down win probability estimates',
    lane: 'sports',
  });

  assert.equal(matchesPersonalTasteTopic(falsePositive, ['nfl-analytics']), false);
  assert.equal(personalTasteTags(falsePositive.title).includes('nfl'), false);
  assert.equal(matchesPersonalTasteTopic(realEpa, ['nfl-analytics']), true);
});

test('explicit taste map recognizes neural foundation models, mechanistic interpretability, and remote sensing', () => {
  const foundationModel = item('foundation-model', {
    title: 'Self-supervised EEG foundation model improves neural decoding transfer',
    lane: 'neuro_frontier',
    tags: ['eeg', 'neural decoding'],
  });
  const mechInterp = item('mechinterp', {
    title: 'Mechanistic interpretability with sparse autoencoders and activation patching',
    lane: 'methods',
    tags: ['causal tracing'],
  });
  const earthObservation = item('earth-observation', {
    title: 'Satellite imagery inverse problem for SAR and hyperspectral remote sensing',
    lane: 'broad_science',
    tags: ['computational imaging'],
  });

  assert.equal(matchesPersonalTasteTopic(foundationModel, ['neuro-foundation-models']), true);
  assert.equal(matchesPersonalTasteTopic(mechInterp, ['mechanistic-interpretability']), true);
  assert.equal(matchesPersonalTasteTopic(earthObservation, ['earth-observation']), true);
  assert.ok(personalTasteRankingPrior(foundationModel) > 0.1);
  assert.ok(personalTasteRankingPrior(mechInterp) > 0.1);
  assert.ok(personalTasteRankingPrior(earthObservation) > 0.09);
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

test('daily run reserves separate NFL, fantasy, sports-data, visualization, and watchable slots', () => {
  const generic = Array.from({ length: 18 }, (_, index) => item(`generic-${index}`, {
    lane: index % 2 ? 'ai_frontier' : 'ml_data',
    title: `Generic signal ${index}`,
    tags: ['generic'],
    importance: index === 0 ? 0.9 : 0.58,
  }));
  const nfl = item('nfl', {
    title: 'NFL player tracking EPA and CPOE state model',
    lane: 'sports',
    tags: ['nfl', 'player tracking', 'epa', 'cpoe'],
  });
  const fantasy = item('fantasy', {
    title: 'Superflex ADP and route participation model update',
    lane: 'sports',
    tags: ['fantasy football', 'superflex', '2qb', 'player usage'],
  });
  const sportsData = item('sports-data', {
    title: 'NBA and soccer tracking-data visualization toolkit',
    lane: 'sports',
    tags: ['sports analytics', 'sports data', 'visualization'],
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

  const run = selectDailyRun(
    [...generic, nfl, fantasy, sportsData, visualization, watchable],
    {},
    14,
    new Date('2026-08-23T20:00:00.000Z')
  );
  const ids = new Set(run.map((entry) => entry.id));
  assert.ok(ids.has('nfl'));
  assert.ok(ids.has('fantasy'));
  assert.ok(ids.has('sports-data'));
  assert.ok(ids.has('visualization'));
  assert.ok(ids.has('watchable'));
});

test('generic AI cannot fill multiple fallback slots when higher-fit material exists', () => {
  const genericAi = Array.from({ length: 8 }, (_, index) => item(`generic-ai-${index}`, {
    lane: 'ai_frontier',
    title: `Generic model release ${index}`,
    tags: ['language model', 'release'],
    baseScore: 0.96 - index * 0.01,
  }));
  const alternatives = Array.from({ length: 8 }, (_, index) => item(`method-${index}`, {
    lane: index % 2 ? 'methods' : 'creative_tech',
    title: `Useful project method ${index}`,
    tags: ['methods'],
    baseScore: 0.7 - index * 0.01,
  }));

  const run = selectDailyRun([...genericAi, ...alternatives], {}, 8, new Date('2026-08-23T20:00:00.000Z'));
  assert.ok(run.filter((entry) => entry.lane === 'ai_frontier').length <= 1);
});

test('brand-new browsers use the personalized snapshot before adaptive live fanout', () => {
  const profile = createInitialProfile();
  profile.topicAffinity = {};
  profile.knownTopics = {};
  profile.meaningfulInteractions = 0;

  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-23T12:00:00.000Z'));
  assert.deepEqual(focus, []);
});

test('adaptive discovery restores explicit seed anchors once local learning has evidence', () => {
  const profile = createInitialProfile();
  profile.topicAffinity = {};
  profile.knownTopics = {};
  profile.meaningfulInteractions = 1;

  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-23T12:00:00.000Z'));
  const seedSet = new Set(FRONTIER_DISCOVERY_SEEDS.map((seed) => seed.toLowerCase()));
  assert.equal(focus.length, 7);
  assert.ok(focus.filter((topic) => seedSet.has(topic)).length >= 3);
});
