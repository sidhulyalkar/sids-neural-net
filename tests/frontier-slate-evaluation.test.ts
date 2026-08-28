import assert from 'node:assert/strict';
import test from 'node:test';
import { frontierRerankWindowSize, selectAdaptiveDailyAllocation } from '../lib/frontier/adaptiveSlate';
import { evaluateSlateCounterfactual, frontierSlateShape } from '../lib/frontier/slateEvaluation';
import type { FrontierItem, FrontierLaneId } from '../lib/frontier/types';

function item(id: string, lane: FrontierLaneId, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://${id}.example/story`,
    source: `${id}.example`,
    sourceLabel: id,
    sourceKind: 'rss',
    publishedAt: '2026-08-27T12:00:00.000Z',
    lane,
    tags: ['frontier-test'],
    baseScore: 0.75,
    importance: 0.58,
    novelty: 0.58,
    quality: 0.82,
    momentum: 0.55,
    ...overrides,
  };
}

test('slate shape exposes bounded source family lane and realm concentration', () => {
  const slate = [
    item('research-a', 'ml_data'),
    item('research-b', 'neuro_frontier'),
    item('builder', 'builder_signal'),
    item('sports', 'sports'),
    item('game', 'gaming'),
  ];
  const shape = frontierSlateShape(slate);
  assert.equal(shape.count, 5);
  assert.equal(shape.uniqueSources, 5);
  assert.equal(shape.uniqueFamilies, 4);
  assert.equal(shape.uniqueLanes, 5);
  assert.equal(shape.learnCount, 3);
  assert.equal(shape.playCount, 2);
  assert.ok(shape.maxSourceShare > 0 && shape.maxSourceShare <= 1);
  assert.ok(shape.sourceHhi > 0 && shape.sourceHhi <= 1);
  assert.ok(shape.maxFamilyShare > 0 && shape.maxFamilyShare <= 1);
  assert.ok(shape.familyHhi > 0 && shape.familyHhi <= 1);
});

test('adaptive composition measurably reduces a concentrated raw top-N without abandoning learned rank', () => {
  const researchFlood = Array.from({ length: 10 }, (_, index) => item(`paper-${index}`, index % 2 ? 'ai_frontier' : 'ml_data', {
    url: `https://papers.example/${index}`,
    source: 'papers.example',
    quality: 0.9,
  }));
  const diverse = [
    item('builder-a', 'builder_signal'),
    item('builder-b', 'creative_tech'),
    item('sports-a', 'sports'),
    item('sports-b', 'team_pulse'),
    item('game', 'gaming'),
    item('screen', 'screen'),
    item('music', 'music'),
    item('life', 'life'),
    item('wild', 'wildcards'),
    item('world', 'world_pulse'),
    item('science', 'broad_science'),
  ];
  const ranked = [...researchFlood, ...diverse];
  const selected = selectAdaptiveDailyAllocation(ranked, 14);
  const audit = evaluateSlateCounterfactual(ranked, selected, 14);

  assert.equal(audit.rerankWindowSize, 21);
  assert.ok(audit.selectedCount >= 8, `adaptive slate unexpectedly collapsed to ${audit.selectedCount}`);
  assert.ok(audit.sourceConcentrationImprovement > 0, `source HHI did not improve: ${audit.sourceConcentrationImprovement}`);
  assert.ok(audit.familyConcentrationImprovement > 0, `family HHI did not improve: ${audit.familyConcentrationImprovement}`);
  assert.ok(audit.adaptive.uniqueLanes >= audit.raw.uniqueLanes);
  assert.ok(audit.adaptive.learnCount > 0 && audit.adaptive.playCount > 0);
  assert.ok(audit.rankUtilityRetention >= 0.65, `rank utility retention fell to ${audit.rankUtilityRetention}`);
  assert.ok(audit.maxSelectedRank <= 21);
  assert.ok(audit.maxOrdinaryPromotionDepth <= 7);
});

test('an already diverse learned frontier is preserved rather than churned for its own sake', () => {
  const lanes: FrontierLaneId[] = [
    'neuro_frontier', 'methods', 'builder_signal', 'sports', 'gaming', 'screen', 'music',
    'ml_data', 'creative_tech', 'team_pulse', 'life', 'broad_science', 'wildcards', 'premier_league',
  ];
  const ranked = lanes.map((lane, index) => item(`top-${index}`, lane));
  const selected = selectAdaptiveDailyAllocation(ranked, 14);
  const audit = evaluateSlateCounterfactual(ranked, selected, 14);

  assert.equal(audit.rawTopCount, 14);
  assert.equal(audit.selectedCount, 14);
  assert.equal(audit.overlapCount, 14);
  assert.equal(audit.overrideCount, 0);
  assert.equal(audit.overrideRate, 0);
  assert.equal(audit.rankUtilityRetention, 1);
});

test('counterfactual audit distinguishes allowed policy interrupts from ordinary local promotions', () => {
  const ranked = Array.from({ length: 30 }, (_, index) => item(
    `rank-${index}`,
    index === 27 ? 'must_know' : index % 3 === 0 ? 'gaming' : 'ml_data',
    { importance: index === 27 ? 0.95 : 0.58 },
  ));
  const selected = selectAdaptiveDailyAllocation(ranked, 14);
  const audit = evaluateSlateCounterfactual(ranked, selected, 14);

  assert.ok(selected.some((entry) => entry.id === 'rank-27'));
  assert.ok(audit.policyInterruptPromotionCount >= 1);
  assert.ok(audit.maxSelectedRank >= 28);
  assert.ok(audit.maxOrdinaryPromotionDepth <= frontierRerankWindowSize(14, ranked.length) - 14);
});

test('counterfactual metrics are deterministic and never alter selection', () => {
  const ranked = Array.from({ length: 24 }, (_, index) => item(
    `candidate-${index}`,
    (['ml_data', 'methods', 'sports', 'gaming', 'screen', 'wildcards'] as FrontierLaneId[])[index % 6],
  ));
  const selected = selectAdaptiveDailyAllocation(ranked, 14);
  const before = selected.map((entry) => entry.id);
  const first = evaluateSlateCounterfactual(ranked, selected, 14);
  const second = evaluateSlateCounterfactual(ranked, selected, 14);

  assert.deepEqual(first, second);
  assert.deepEqual(selected.map((entry) => entry.id), before);
  assert.ok(first.overrideRate >= 0 && first.overrideRate <= 1);
  assert.ok(first.rankUtilityRetention >= 0 && first.rankUtilityRetention <= 1);
  assert.ok(first.familyDiagnostics.every((entry) => entry.targetShare >= 0 && entry.targetShare <= 0.38 + Number.EPSILON));
});
