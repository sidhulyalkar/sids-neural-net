import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDailyRun } from '../lib/frontier/scoring';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'wildcards',
    tags: ['frontier-test'],
    baseScore: 0.8,
    importance: 0.55,
    novelty: 0.55,
    quality: 0.8,
    momentum: 0.6,
    ...overrides,
  };
}

test('presentation media cannot preempt a higher-ranked recommendation', () => {
  const rankedWithoutMedia = [
    item('top-interest', { lane: 'must_know', importance: 0.92 }),
    item('lower-visual', { lane: 'must_know', importance: 0.86 }),
    item('builder', { lane: 'builder_signal' }),
    item('gaming', { lane: 'gaming' }),
    item('music', { lane: 'music' }),
  ];
  const rankedWithMedia = rankedWithoutMedia.map((entry) =>
    entry.id === 'lower-visual'
      ? { ...entry, media: { type: 'image' as const, url: 'https://example.com/visual.jpg' } }
      : entry
  );

  const plain = selectDailyRun(rankedWithoutMedia, {}, 5).map((entry) => entry.id);
  const visual = selectDailyRun(rankedWithMedia, {}, 5).map((entry) => entry.id);

  assert.deepEqual(visual, plain);
  assert.equal(visual[0], 'top-interest');
});

test('daily selection preserves diversity instead of flooding concentrated generic material', () => {
  const concentrated = Array.from({ length: 10 }, (_, index) => item(`samey-${index}`, {
    lane: 'wildcards',
    novelty: 0.8,
    url: `https://same-source.example/story-${index}`,
    source: 'same-source.example',
    sourceLabel: 'Same Source',
  }));

  const selected = selectDailyRun(concentrated, {}, 6);

  assert.ok(selected.length <= 2, `expected diversity guard to stop concentrated fill, saw ${selected.length}`);
  assert.equal(new Set(selected.map((entry) => entry.lane)).size, 1);
  assert.equal(new Set(selected.map((entry) => new URL(entry.url).hostname)).size, 1);
});

test('generic research cannot crowd out explicitly personalized daily lanes', () => {
  const genericResearch = Array.from({ length: 9 }, (_, index) => item(`paper-${index}`, {
    lane: index % 2 === 0 ? 'ai_frontier' : 'ml_data',
    importance: 0.82 - index * 0.01,
    novelty: 0.66,
    source: `papers-${index % 3}.example`,
    sourceLabel: 'Research Feed',
    url: `https://papers-${index % 3}.example/${index}`,
  }));
  const ranked = [
    ...genericResearch,
    item('my-team', {
      lane: 'team_pulse',
      tags: ['new england patriots', 'active team'],
      source: 'team.example',
      sourceLabel: 'Team Feed',
      url: 'https://team.example/patriots',
    }),
    item('active-sport', {
      lane: 'sports',
      tags: ['active sport', 'mountain biking'],
      source: 'mtb.example',
      sourceLabel: 'MTB',
      url: 'https://mtb.example/run',
    }),
    item('game', {
      lane: 'gaming',
      tags: ['hollow knight', 'silksong'],
      source: 'games.example',
      sourceLabel: 'Games',
      url: 'https://games.example/silksong',
    }),
    item('music', {
      lane: 'music',
      tags: ['dubstep', 'bass music'],
      source: 'music.example',
      sourceLabel: 'Music',
      url: 'https://music.example/set',
    }),
  ];

  const selected = selectDailyRun(ranked, {}, 14);
  const ids = new Set(selected.map((entry) => entry.id));

  assert.ok(ids.has('my-team'), 'favorite-team slot was crowded out by generic research');
  assert.ok(ids.has('active-sport'), 'active-sport slot was crowded out by generic research');
  assert.ok(ids.has('game'), 'gaming slot was crowded out by generic research');
  assert.ok(ids.has('music'), 'music/culture slot was crowded out by generic research');
});

test('generic life incident cannot steal the finite leisure slot from explicit taste', () => {
  const ranked = [
    item('generic-nfl-owner-incident', {
      title: 'NFL team owner faces unrelated legal proceeding',
      summary: 'A legal incident involving an owner with no football analysis, favorite-team relevance, or fantasy consequence.',
      lane: 'life',
      tags: ['sport', 'legal news'],
      baseScore: 0.91,
      quality: 0.9,
      source: 'news.example',
      sourceLabel: 'News',
      url: 'https://news.example/unrelated-owner-incident',
    }),
    item('bass-release', {
      title: 'Virtual Riot releases a new bass set',
      summary: 'A fresh dubstep set with production notes.',
      lane: 'music',
      tags: ['virtual riot', 'dubstep', 'bass music'],
      baseScore: 0.7,
      source: 'music.example',
      sourceLabel: 'Music',
      url: 'https://music.example/bass-release',
    }),
  ];

  const selected = selectDailyRun(ranked, {}, 1);
  assert.deepEqual(selected.map((entry) => entry.id), ['bass-release']);
});

test('personalized fill runs before generic exploration when scarce slots remain', () => {
  const ranked = [
    item('generic-high-score', {
      lane: 'wildcards',
      title: 'Broad but weakly personalized story',
      baseScore: 0.95,
      quality: 0.92,
      url: 'https://generic.example/story',
      source: 'generic.example',
    }),
    item('neuroglancer-lower-score', {
      lane: 'neuro_frontier',
      title: 'Neuroglancer adds a new volumetric rendering workflow',
      summary: 'Scientific visualization improvements for connectomics data.',
      tags: ['neuroglancer', 'scientific visualization', 'connectomics'],
      baseScore: 0.66,
      importance: 0.6,
      url: 'https://neuro.example/neuroglancer',
      source: 'neuro.example',
    }),
  ];

  const selected = selectDailyRun(ranked, {}, 1);
  assert.deepEqual(selected.map((entry) => entry.id), ['neuroglancer-lower-score']);
});

test('taste-matched life material remains eligible for the leisure slot', () => {
  const ranked = [
    item('generic-life', {
      lane: 'life',
      title: 'Generic celebrity lifestyle story',
      tags: ['culture'],
      baseScore: 0.9,
      url: 'https://generic.example/life',
      source: 'generic.example',
    }),
    item('husky-trail', {
      lane: 'life',
      title: 'Huskies on an alpine trail',
      summary: 'Nature photography and a mountain trail field note.',
      tags: ['huskies', 'nature photography', 'landscape photography'],
      baseScore: 0.62,
      url: 'https://outdoors.example/husky-trail',
      source: 'outdoors.example',
    }),
  ];

  const selected = selectDailyRun(ranked, {}, 1);
  assert.deepEqual(selected.map((entry) => entry.id), ['husky-trail']);
});
