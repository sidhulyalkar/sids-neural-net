import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFrontierStoryPresentation, frontierStoryFormat } from '../lib/frontier/storyPresentation';
import type { FrontierItem } from '../lib/frontier/types';

const sample: FrontierItem = {
  id: 'source-item', title: 'A documented result',
  url: 'https://example.org/original', summary: 'A source-grounded description.',
  source: 'example.org', sourceLabel: 'Publisher', sourceKind: 'rss',
  lane: 'broad_science', tags: [], publishedAt: '2026-11-01T08:00:00Z',
  quality: .8, importance: .7, novelty: .6, momentum: .6, baseScore: .8,
};

test('source-kind presentation never invents conclusions or confuses preprints with reviewed evidence', () => {
  const arxiv = buildFrontierStoryPresentation({ ...sample, sourceKind: 'arxiv' });
  assert.equal(arxiv.format, 'research');
  assert.equal(arxiv.summaryLabel, 'Abstract / source excerpt');
  assert.match(arxiv.evidenceNote ?? '', /Preprint source/);
  assert.equal(arxiv.sourceActionLabel, 'Open research source');
  const openalex = buildFrontierStoryPresentation({ ...sample, sourceKind: 'openalex' });
  assert.equal(openalex.sourceActionLabel, 'Open research record');
  assert.match(openalex.evidenceNote ?? '', /metadata record/);
  assert.equal(openalex.sportsPriority, false);
});

test('creator descriptions and GitHub descriptions are attributed, not recast as independent reviews', () => {
  const video = buildFrontierStoryPresentation({ ...sample, sourceKind: 'youtube' });
  assert.equal(video.summaryLabel, 'Creator description');
  assert.equal(video.sourceActionLabel, 'Watch original');
  assert.match(video.evidenceNote ?? '', /not an independent transcript/);
  const repo = buildFrontierStoryPresentation({ ...sample, sourceKind: 'github' });
  assert.equal(repo.summaryLabel, 'Repository description');
  assert.equal(repo.sourceActionLabel, 'View repository');
  assert.match(repo.evidenceNote ?? '', /not validated performance/);
});

test('popularity statistics are activity, never reported scientific outcomes', () => {
  const repo = buildFrontierStoryPresentation({ ...sample, sourceKind: 'github',
    metrics: [
      { label: 'stars', value: '5,618' },
      { label: 'forks', value: '501' },
      { label: 'inference latency', value: '24 ms', detail: 'As reported by source' },
    ],
  });
  assert.deepEqual(repo.metricSections.map(x => [x.kind, x.title]),
    [['reported', 'Numbers reported by the source'], ['activity', 'Repository activity']]);
  assert.deepEqual(repo.metricSections[0].metrics.map(x => x.label), ['inference latency']);
  assert.deepEqual(repo.metricSections[1].metrics.map(x => x.label), ['stars', 'forks']);
  const paper = buildFrontierStoryPresentation({
    ...sample, sourceKind: 'openalex', metrics: [{ label: 'citations', value: '0' }],
  });
  assert.equal(paper.metricSections.length, 1);
  assert.equal(paper.metricSections[0].kind, 'activity');
  assert.equal(paper.metricSections[0].title, 'Citation activity');
  const hn = buildFrontierStoryPresentation({
    ...sample, sourceKind: 'hackernews', metrics: [
      { label: 'points', value: '12' }, { label: 'comments', value: '3' },
    ],
  });
  assert.equal(hn.metricSections[0].title, 'Source activity');
  assert.equal(hn.metricSections[0].kind, 'activity');
});

test('source-backed scoreboards and standings are prominent without guessing outcomes', () => {
  const sports = {
    ...sample, sourceKind: 'sports_state' as const, lane: 'sports' as const,
    sportsState: {
      kind: 'scoreboard' as const, league: 'nba', leagueLabel: 'NBA',
      games: [{ id: 'g', date: sample.publishedAt, status: 'Halftime',
        live: true, completed: false, competitors: [
          { name: 'Home', shortName: 'Home', abbreviation: 'H', score: '44' },
          { name: 'Away', shortName: 'Away', abbreviation: 'A', score: '42' },
        ] }],
    },
    metrics: [{ label: 'live', value: '1' }, { label: 'upcoming', value: '4' }],
  };
  const presentation = buildFrontierStoryPresentation(sports);
  assert.equal(presentation.sportsPriority, true);
  assert.equal(presentation.format, 'sports');
  assert.equal(presentation.sourceActionLabel, 'View score source');
  assert.equal(presentation.metricSections[0].kind, 'activity');
  assert.equal(presentation.metricSections[0].title, 'Schedule status');
  assert.equal(frontierStoryFormat(sports), 'sports');

  const standalone = buildFrontierStoryPresentation({
    ...sample, sourceKind: 'sports_state', sportsState: undefined,
  });
  assert.equal(standalone.sportsPriority, false);
});

test('unknown and zero-evidence formats gracefully retain authentic original-source actions', () => {
  const article = buildFrontierStoryPresentation(sample);
  assert.equal(article.format, 'article');
  assert.equal(article.metricSections.length, 0);
  assert.equal(article.sourceActionLabel, 'Read original');
  assert.equal(article.evidenceNote, undefined);
  const discussion = buildFrontierStoryPresentation({ ...sample, sourceKind: 'lobsters' });
  assert.equal(discussion.sourceActionLabel, 'Open discussion');
  assert.match(discussion.evidenceNote ?? '', /not independent verification/);
  const game = buildFrontierStoryPresentation({ ...sample, sourceKind: 'steam' });
  assert.equal(game.format, 'game');
});
