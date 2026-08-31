import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAdaptiveDailyAllocation } from '../lib/frontier/adaptiveSlate';
import { auditFrontierSlateTasteAuthority } from '../lib/frontier/slateTasteAuthorityAudit';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} neutral report`,
    summary: 'A routine neutral update without a fixed personal taste match.',
    url: `https://${id}.example/story`,
    source: `${id}.example`,
    sourceLabel: id,
    sourceKind: 'rss',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'sports',
    tags: ['neutral-topic'],
    baseScore: 0.7,
    importance: 0.55,
    novelty: 0.52,
    quality: 0.76,
    momentum: 0.48,
    ...overrides,
  };
}

test('explicit production taste policy is identical to the default allocator path', () => {
  const ranked = [
    item('generic'),
    item('nfl', {
      title: 'NFL analytics player tracking update',
      tags: ['nfl analytics', 'player tracking'],
    }),
    item('game', { lane: 'gaming' }),
    item('builder', { lane: 'builder_signal' }),
  ];

  assert.deepEqual(
    selectAdaptiveDailyAllocation(ranked, 3).map((entry) => entry.id),
    selectAdaptiveDailyAllocation(ranked, 3, { tastePolicy: 'production' }).map((entry) => entry.id),
  );
});

test('whole-policy taste removal can swap a slate seat without removing learned rank itself', () => {
  const ranked = [
    item('generic'),
    item('nfl-fit', {
      title: 'NFL analytics player tracking update',
      tags: ['nfl analytics', 'player tracking', 'play-by-play'],
    }),
  ];

  const production = selectAdaptiveDailyAllocation(ranked, 1);
  const disabled = selectAdaptiveDailyAllocation(ranked, 1, { tastePolicy: 'disabled' });

  assert.equal(production[0]?.id, 'nfl-fit');
  assert.equal(disabled[0]?.id, 'generic');

  const audit = auditFrontierSlateTasteAuthority(ranked, 1);
  assert.equal(audit.productionSelected, 1);
  assert.equal(audit.disabledSelected, 1);
  assert.equal(audit.sharedSelected, 0);
  assert.equal(audit.protectedByTaste, 1);
  assert.equal(audit.displacedWithoutTaste, 1);
  assert.equal(audit.changedMembership, 2);
  assert.equal(audit.overlapRate, 0);
  assert.equal(audit.familyDeltas.find((entry) => entry.family === 'sports')?.delta, 0);
});

test('disabled policy removes the taste-keyed generic AI brake together with taste penalties', () => {
  const ranked = [
    item('ai-0', {
      lane: 'ai_frontier',
      title: 'General AI model industry update',
      tags: ['general ai'],
      quality: 0.94,
      importance: 0.7,
    }),
    item('ai-1', {
      lane: 'ai_frontier',
      title: 'Another general AI model industry update',
      tags: ['general ai'],
      quality: 0.93,
      importance: 0.69,
    }),
    item('game', { lane: 'gaming', quality: 0.8 }),
    item('sports', { lane: 'sports', quality: 0.78 }),
    item('builder', { lane: 'builder_signal', quality: 0.7 }),
  ];

  const production = selectAdaptiveDailyAllocation(ranked, 4);
  const disabled = selectAdaptiveDailyAllocation(ranked, 4, { tastePolicy: 'disabled' });
  const productionAi = production.filter((entry) => entry.lane === 'ai_frontier').length;
  const disabledAi = disabled.filter((entry) => entry.lane === 'ai_frontier').length;

  assert.equal(productionAi, 1);
  assert.equal(disabledAi, 2);
  assert.ok(production.some((entry) => entry.lane === 'gaming' || entry.lane === 'sports'));
  assert.ok(disabled.some((entry) => entry.lane === 'gaming' || entry.lane === 'sports'));
});

test('slate taste audit returns only aggregate membership and family diagnostics', () => {
  const ranked = [
    item('private-id-a'),
    item('private-id-b', {
      title: 'NFL analytics player tracking update',
      tags: ['nfl analytics', 'player tracking'],
    }),
    item('private-id-c', { lane: 'gaming' }),
  ];
  const audit = auditFrontierSlateTasteAuthority(ranked, 2);

  assert.equal(audit.schema, 'frontier-slate-taste-authority-v1');
  assert.equal(audit.causalScope, 'whole-fixed-taste-slate-policy');
  assert.equal(audit.familyDeltas.length, 6);
  const serialized = JSON.stringify(audit).toLowerCase();
  for (const forbidden of ['private-id', 'title', 'summary', 'url', 'tags']) {
    assert.equal(serialized.includes(forbidden), false, `slate audit leaked ${forbidden}`);
  }
});
