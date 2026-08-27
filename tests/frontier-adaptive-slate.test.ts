import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierEditorialFamily,
  selectAdaptiveDailyAllocation,
  slateCompositionDiagnostics,
} from '../lib/frontier/adaptiveSlate';
import { selectDailyRun } from '../lib/frontier/scoring';
import type { FrontierItem, FrontierLaneId } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://${id}.example/story`,
    source: `${id}.example`,
    sourceLabel: id,
    sourceKind: 'rss',
    publishedAt: '2026-08-27T12:00:00.000Z',
    lane: 'wildcards',
    tags: ['frontier-test'],
    baseScore: 0.75,
    importance: 0.58,
    novelty: 0.58,
    quality: 0.82,
    momentum: 0.55,
    ...overrides,
  };
}

test('editorial families stay internal and cover every public lane', () => {
  const cases: Array<[FrontierLaneId, ReturnType<typeof frontierEditorialFamily>]> = [
    ['must_know', 'consequential'],
    ['world_pulse', 'consequential'],
    ['neuro_frontier', 'research'],
    ['ml_data', 'research'],
    ['builder_signal', 'builder'],
    ['creative_tech', 'builder'],
    ['team_pulse', 'sports'],
    ['premier_league', 'sports'],
    ['gaming', 'culture'],
    ['screen', 'culture'],
    ['music', 'culture'],
    ['life', 'leisure'],
    ['wildcards', 'leisure'],
  ];
  for (const [lane, family] of cases) assert.equal(frontierEditorialFamily(item(lane, { lane })), family);
});

test('finite runs preserve Brainfood and After Hours without forcing micro-topics', () => {
  const ranked = [
    item('neuro-1', { lane: 'neuro_frontier', tags: ['neuroscience'] }),
    item('ml-1', { lane: 'ml_data', tags: ['machine learning'] }),
    item('method-1', { lane: 'methods', tags: ['inverse problem'] }),
    item('builder-1', { lane: 'builder_signal', sourceKind: 'github', tags: ['open source'] }),
    item('game-1', { lane: 'gaming', tags: ['video game'] }),
    item('music-1', { lane: 'music', tags: ['bass music'] }),
  ];

  const selected = selectAdaptiveDailyAllocation(ranked, 4);
  const lanes = selected.map((entry) => entry.lane);
  assert.ok(lanes.some((lane) => ['neuro_frontier', 'ml_data', 'methods', 'builder_signal'].includes(lane)));
  assert.ok(lanes.some((lane) => ['gaming', 'music'].includes(lane)));
  assert.equal(selected.length, 4);
});

test('a static micro-interest cannot demand a seat after learned rank moves it far down', () => {
  const ranked = [
    item('team-analysis', { lane: 'team_pulse', tags: ['team analysis'] }),
    item('sports-data', { lane: 'sports', tags: ['sports data', 'player tracking'] }),
    item('soccer-tactics', { lane: 'premier_league', tags: ['football tactics'] }),
    item('neuro', { lane: 'neuro_frontier', tags: ['neuroscience'] }),
    item('builder', { lane: 'builder_signal', sourceKind: 'github', tags: ['open source'] }),
    item('game', { lane: 'gaming', tags: ['video game'] }),
    item('science', { lane: 'broad_science', tags: ['science'] }),
    item('method', { lane: 'methods', tags: ['method'] }),
    item('screen', { lane: 'screen', tags: ['screen orbit'] }),
    item('music', { lane: 'music', tags: ['bass music'] }),
    item('fantasy-low-rank', {
      lane: 'sports',
      tags: ['fantasy football', 'superflex', 'target share'],
      quality: 0.78,
      importance: 0.5,
    }),
  ];

  const selected = selectAdaptiveDailyAllocation(ranked, 6);
  assert.ok(selected.some((entry) => frontierEditorialFamily(entry) === 'sports'));
  assert.ok(!selected.some((entry) => entry.id === 'fantasy-low-rank'), 'micro-topic reservation overrode learned rank');
});

test('same-source volume cannot manufacture additional family demand', () => {
  const first = item('paper-0', {
    lane: 'neuro_frontier',
    url: 'https://papers.example/0',
    source: 'papers.example',
  });
  const singleDemand = slateCompositionDiagnostics([first], [first])
    .find((entry) => entry.family === 'research')?.demand;
  const flooded = [
    first,
    ...Array.from({ length: 20 }, (_, index) => item(`paper-${index + 1}`, {
      lane: 'ai_frontier',
      url: `https://papers.example/${index + 1}`,
      source: 'papers.example',
    })),
  ];
  const floodedDemand = slateCompositionDiagnostics(flooded, [first])
    .find((entry) => entry.family === 'research')?.demand;

  assert.equal(floodedDemand, singleDemand);
});

test('adaptive composition caps host and family concentration', () => {
  const researchFlood = Array.from({ length: 18 }, (_, index) => item(`paper-${index}`, {
    lane: index % 2 ? 'ai_frontier' : 'ml_data',
    url: `https://papers.example/${index}`,
    source: 'papers.example',
    quality: 0.9,
  }));
  const diverse = [
    item('builder', { lane: 'builder_signal', sourceKind: 'github' }),
    item('team', { lane: 'team_pulse' }),
    item('game', { lane: 'gaming' }),
    item('music', { lane: 'music' }),
    item('outside', { lane: 'life', tags: ['nature photography'] }),
    item('world', { lane: 'world_pulse' }),
  ];

  const selected = selectAdaptiveDailyAllocation([...researchFlood, ...diverse], 14);
  const paperHostCount = selected.filter((entry) => new URL(entry.url).hostname === 'papers.example').length;
  const researchCount = selected.filter((entry) => frontierEditorialFamily(entry) === 'research').length;

  assert.ok(paperHostCount <= 2, `same host occupied ${paperHostCount} slots`);
  assert.ok(researchCount <= 6, `research family occupied ${researchCount} slots`);
  assert.ok(selected.some((entry) => frontierEditorialFamily(entry) === 'culture'));
  assert.ok(selected.some((entry) => frontierEditorialFamily(entry) === 'sports'));
});

test('composition diagnostics expose bounded targets and realized shares', () => {
  const ranked = [
    item('research', { lane: 'neuro_frontier' }),
    item('builder', { lane: 'builder_signal', sourceKind: 'github' }),
    item('sports', { lane: 'sports' }),
    item('culture', { lane: 'gaming' }),
    item('leisure', { lane: 'life', tags: ['nature photography'] }),
  ];
  const selected = selectAdaptiveDailyAllocation(ranked, 5);
  const diagnostics = slateCompositionDiagnostics(ranked, selected);

  assert.equal(diagnostics.length, 6);
  assert.ok(diagnostics.every((entry) => entry.targetShare <= 0.38 + Number.EPSILON));
  const realized = diagnostics.reduce((sum, entry) => sum + entry.realizedShare, 0);
  assert.ok(Math.abs(realized - 1) < 1e-9);
  assert.equal(diagnostics.reduce((sum, entry) => sum + entry.selected, 0), selected.length);
});

test('expanded adaptive browse preserves the canonical 14-card opening exactly', () => {
  const lanes: FrontierLaneId[] = [
    'neuro_frontier',
    'ml_data',
    'methods',
    'builder_signal',
    'team_pulse',
    'sports',
    'gaming',
    'screen',
    'music',
    'life',
    'wildcards',
  ];
  const ranked = Array.from({ length: 72 }, (_, index) => item(`deep-${index}`, {
    lane: lanes[index % lanes.length],
    source: `source-${index}.example`,
    url: `https://source-${index}.example/story`,
    tags: index % lanes.length === 8 ? ['bass music'] : ['frontier-test'],
  }));

  const canonical = selectDailyRun(ranked, {}, 14);
  const expanded = selectDailyRun(ranked, {}, 48);
  assert.deepEqual(
    expanded.slice(0, canonical.length).map((entry) => entry.id),
    canonical.map((entry) => entry.id),
  );
  assert.equal(new Set(expanded.map((entry) => entry.id)).size, expanded.length);
});
