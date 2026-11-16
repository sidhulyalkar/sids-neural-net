import assert from 'node:assert/strict';
import test from 'node:test';
import { journalRealm } from '../lib/frontier/journalPresentation';
import { journalSourceKind, journalSourceLens } from '../lib/frontier/journalSourceLens';
import type { FrontierItem } from '../lib/frontier/types';

const paper: FrontierItem = {
  id: 'paper', title: 'Evaluation paper', summary: 'An observed result.',
  url: 'https://arxiv.org/abs/2611.01234', source: 'arxiv.org',
  sourceLabel: 'arXiv', sourceKind: 'arxiv',
  publishedAt: '2026-11-13T12:00:00.000Z', lane: 'ml_data',
  tags: ['cs.LG', 'research', 'paper'], authors: ['Author A', 'Author B'],
  baseScore: 0.8, importance: 0.8, novelty: 0.8, quality: 0.8, momentum: 0.8,
};

test('each source type produces an accurate editorial lens, not a generic card', () => {
  assert.equal(journalSourceKind(paper), 'paper');
  assert.equal(journalSourceLens(paper, 0).identity, 'arXiv · 2611.01234');
  assert.deepEqual(journalSourceLens(paper, 0).documentLinks, [
    { label: 'Read paper PDF', url: 'https://arxiv.org/pdf/2611.01234' },
  ]);
  assert.deepEqual(journalSourceLens(paper, 0).facts, [{ label: 'Authors listed', value: '2' }]);
  const repo = { ...paper, sourceKind: 'github' as const, url: 'https://github.com/allenai/ai2thor',
    metrics: [{ label: 'stars', value: '900' }, { label: 'forks', value: '87' }] };
  assert.equal(journalSourceKind(repo), 'repository');
  const lens = journalSourceLens(repo, 0);
  assert.equal(lens.identity, 'allenai / ai2thor');
  assert.equal(lens.kind, 'repository');
  assert.deepEqual(lens.facts.map((fact) => fact.label), ['stars', 'forks']);
  const thread = { ...paper, sourceKind: 'lobsters' as const, metrics: [{ label: 'comments', value: '14' }] };
  assert.equal(journalSourceKind(thread), 'discussion');
  assert.equal(journalSourceLens(thread, 0).facts[0].label, 'comments');
});

test('video duration, sports states and genuine figures use only source-backed fields', () => {
  const video = { ...paper, sourceKind: 'youtube' as const, media: { type: 'youtube' as const, url: 'abc',
    duration: 125 } };
  assert.equal(journalSourceKind(video), 'watch');
  assert.deepEqual(journalSourceLens(video, 0).facts, [{ label: 'Duration', value: '2:05' }]);
  assert.deepEqual(journalSourceLens({ ...video, media: { ...video.media, duration: -9 } }, 0).facts, []);
  const sports = { ...paper, sportsState: { kind: 'scoreboard' as const, league: 'test',
    leagueLabel: 'Test league', games: [{ id: '1', date: '2026-11-13', status: 'Final', live: false, completed: true, competitors: [] }] } };
  assert.equal(journalSourceKind(sports), 'match');
  assert.equal(journalSourceLens(sports, 0).identity, 'Test league');
  assert.deepEqual(journalSourceLens(sports, 0).facts, [{ label: 'Matches reported', value: '1' }]);
  const figure = journalSourceLens(paper, 2);
  assert.ok(figure.facts.some((fact) => fact.label === 'Source figures' && fact.value === '2'));
});

test('source URL parsing cannot manufacture a GitHub repo or publication identity', () => {
  const invalid = journalSourceLens({ ...paper, sourceKind: 'github', url: 'https://other.example/allenai/repo',
    sourceLabel: 'Publisher' }, 0);
  assert.equal(invalid.identity, 'Publisher');
  assert.equal(journalSourceLens({ ...paper, url: 'https://example.org/abs/2611.01234' }, 0).identity, 'arXiv');
  assert.equal(journalSourceLens({ ...paper, sourceKind: 'huggingface',
    url: 'https://huggingface.co/papers/2611.06789v2' }, 0).identity, 'HF Papers · 2611.06789v2');
});

test('primary document links require a matching canonical publisher URL', () => {
  const falseHost = { ...paper, url: 'https://untrusted.example/abs/2611.01234' };
  const invalidId = { ...paper, url: 'https://arxiv.org/abs/nothing-valid' };
  const fakeGithub = { ...paper, sourceKind: 'github' as const };
  assert.deepEqual(journalSourceLens(falseHost, 0).documentLinks, []);
  assert.deepEqual(journalSourceLens(invalidId, 0).documentLinks, []);
  assert.deepEqual(journalSourceLens(fakeGithub, 0).documentLinks, []);
  assert.deepEqual(journalSourceLens({ ...paper, url: 'https://arxiv.org/abs/2611.01234v2' }, 0).documentLinks,
    [{ label: 'Read paper PDF', url: 'https://arxiv.org/pdf/2611.01234v2' }]);
});

test('topic-driven visual atmosphere distinguishes behavior from neural systems and does not misclassify wildcards', () => {
  assert.equal(journalRealm({ lane: 'wildcards', tags: ['cs.LG', 'debate learning'] }), 'research');
  assert.equal(journalRealm({ lane: 'wildcards', tags: ['soccer', 'football'] }), 'motion');
  assert.equal(journalRealm({ lane: 'world_pulse', tags: ['oceanography', 'biodiversity'] }), 'nature');
  assert.equal(journalRealm({ lane: 'ml_data', tags: ['neuropixels', 'electrophysiology'] }), 'neural');
  assert.equal(journalRealm({ lane: 'ml_data', tags: ['animal behavior', 'pose estimation'] }), 'behavior');
  assert.equal(journalRealm({ lane: 'ml_data', tags: ['neural networks', 'cs.LG'] }), 'research');
  assert.equal(journalRealm({ lane: 'wildcards', tags: ['community discussions'], sourceKind: 'github' }), 'systems');
});
