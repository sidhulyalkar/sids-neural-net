import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFrontierEditionContents, frontierReaderFormat } from '../lib/frontier/editionContents';
import { buildFrontierSourceBrief } from '../lib/frontier/sourceBrief';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, lane: FrontierItem['lane'], sourceKind: FrontierItem['sourceKind'] = 'rss'): FrontierItem {
  return {
    id, title: 'Study ' + id, summary: 'The authors compare reproducible methods in a publicly documented experiment.',
    url: 'https://example.org/' + id, source: 'example.org', sourceLabel: 'Original source',
    sourceKind, publishedAt: '2026-11-01T12:00:00Z', lane, tags: [],
    baseScore: .7, quality: .8, importance: .6, novelty: .6, momentum: .6,
  };
}

test('edition contents groups existing order without reranking or hiding any items', () => {
  const input = [
    item('s0', 'sports'), item('r1', 'neuro_frontier', 'arxiv'),
    item('g2', 'gaming', 'steam'), item('r3', 'methods'),
    item('w4', 'must_know'), item('x5', 'wildcards'), item('c6', 'creative_tech'),
  ];
  const groups = buildFrontierEditionContents(input);
  assert.deepEqual(groups.map((group) => [group.label, group.entries.map((entry) => entry.position)]), [
    ['Research & tools', [1, 3]], ['Sports & performance', [0]],
    ['Creative & culture', [2, 6]], ['World & life', [4]], ['Discoveries', [5]],
  ]);
  assert.deepEqual(groups.flatMap((group) => group.entries.map((entry) => entry.item.id)).sort(),
    input.map((entry) => entry.id).sort());
  for (const group of groups) for (const entry of group.entries) {
    assert.equal(input[entry.position], entry.item);
  }
  assert.deepEqual(buildFrontierEditionContents([]), []);
});

test('reader format names identify evidence types without exaggerating significance', () => {
  assert.equal(frontierReaderFormat(item('n', 'neuro_frontier', 'arxiv')), 'Research');
  assert.equal(frontierReaderFormat(item('code', 'builder_signal', 'github')), 'Code');
  assert.equal(frontierReaderFormat(item('video', 'sports', 'youtube')), 'Video');
  assert.equal(frontierReaderFormat(item('discuss', 'internet_culture', 'lobsters')), 'Discussion');
  assert.equal(frontierReaderFormat(item('news', 'world_pulse', 'rss')), 'Article');
  assert.equal(frontierReaderFormat({
    ...item('scoreboard', 'sports', 'sports_state'),
    sportsState: { kind: 'scoreboard', league: 'nba', leagueLabel: 'NBA', games: [] },
  }), 'Scores & standings', 'Do not imply a stale sports snapshot is live');
});

test('short lead and visible source sentences preserve every claim and original ordering', () => {
  const source = [
    'Researchers examined representations across two recording sessions using the same preprocessing pipeline.',
    'They compared these outcomes against a held-out validation set and previously published references.',
    'The report includes a numerical ablation testing sensitivity to the sampling rate.',
    'Replication in additional laboratories is listed as future work.',
    'The authors published implementation details and measurement uncertainty.',
  ].join(' ');
  const result = buildFrontierSourceBrief(source);
  assert.equal([result.lead, ...result.details].join(' '), source);
  assert.ok(result.lead.length < source.length);
  assert.ok(result.details.length >= 3);
  assert.equal(result.hasFullerContext, true);
});
