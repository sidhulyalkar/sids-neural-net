import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientEngagementAdjustment, frontierMotifForItem, frontierSwarmSprites } from '../lib/frontier/ambientSprites';
import type { FrontierHistoryEntry, FrontierItem } from '../lib/frontier/types';

function source(lane: FrontierItem['lane'], title: string, tags: string[] = []): FrontierItem {
  return { id:title, title, tags, lane, url:'https://example.com/source', source:'Example',
    sourceLabel:'Example', sourceKind:'rss', publishedAt:'2026-11-19T12:00:00Z',
    summary:'', baseScore:.4, importance:.5, novelty:.5, quality:.5, momentum:.5 };
}
function history(ambientAppearances: number, ambientPops: number, openedAt?: string): FrontierHistoryEntry {
  return { item:source('ai_frontier','Test article'), impressions:1, firstSeenAt:'2026-11-19T12:00:00Z',
    lastSeenAt:'2026-11-19T12:00:00Z', resurfacedCount:0, rewarded:false,
    ambientAppearances, ambientPops, openedAt };
}

test('motifs adapt to the actual source, not a global decorative skin', () => {
  assert.equal(frontierMotifForItem(source('premier_league','Championship match')),'soccer');
  assert.equal(frontierMotifForItem(source('sports','A new halfpipe skiing technique')),'snow');
  assert.equal(frontierMotifForItem(source('neuro_frontier','Neural population dynamics')),'neuron');
  assert.equal(frontierMotifForItem(source('gaming','A new game engine')),'game');
  assert.equal(frontierMotifForItem(source('music','Upcoming albums')),'music');
  assert.equal(frontierMotifForItem(source('life','Marine biodiversity')),'leaf');
  assert.equal(frontierMotifForItem(source('builder_signal','New compiler')),'code');
  assert.equal(frontierMotifForItem(source('ai_frontier','Language reasoning')),'newsprint');
});


test('swarm layout is deterministic, varied, bounded, and independently article-seeded', () => {
  const desktop = frontierSwarmSprites('article-1');
  const repeat = frontierSwarmSprites('article-1');
  const mobile = frontierSwarmSprites('article-1', true);
  assert.deepEqual(desktop, repeat);
  assert.equal(desktop.length, 18);
  assert.equal(mobile.length, 10);
  assert.equal(new Set(desktop.map((sprite) => sprite.colorStep)).size >= 5, true);
  assert.notDeepEqual(desktop, frontierSwarmSprites('article-2'));
  assert.equal(new Set(desktop.map((sprite) => sprite.pattern)).size, 5);
  assert.deepEqual(desktop.slice(0, 5).map((sprite) => sprite.pattern),
    ['hover', 'patrol', 'orbit', 'zigzag', 'cross']);
  for (const sprite of desktop) {
    assert(sprite.x >= 10 && sprite.x <= 95);
    assert(sprite.y >= 10 && sprite.y <= 80);
    assert(sprite.duration >= 3 && sprite.duration <= 10);
    assert(sprite.delay <= 0);
    assert(sprite.size >= 30 && sprite.size <= 42);
    assert(Number.isInteger(sprite.colorStep) && sprite.colorStep >= 0 && sprite.colorStep <= 6);
  }
});

test('intentional swarm clicks yield calibrated ranking evidence, unlike a raw impression', () => {
  assert.equal(ambientEngagementAdjustment(history(0, 1)), 0);
  assert.equal(ambientEngagementAdjustment(history(9, 0)), 0);
  const one = ambientEngagementAdjustment(history(9, 1));
  const half = ambientEngagementAdjustment(history(9, 5));
  const all = ambientEngagementAdjustment(history(9, 9));
  assert(one > 0.002 && one < 0.02);
  assert(half > one);
  assert.equal(all, 0.24);
  assert.equal(ambientEngagementAdjustment(history(9, 100)), 0.24, 'No overcount on replay');
});

test('explicit clear-all outranks an entire caught swarm and does not need a pop', () => {
  const cleared = { ...history(9, 0), ambientClearedAt: '2026-11-19T19:45:00Z' };
  const strong = ambientEngagementAdjustment(cleared);
  assert.equal(strong, 0.62);
  assert(strong > ambientEngagementAdjustment(history(9, 9)) * 2.5);
  assert.equal(ambientEngagementAdjustment({ ...cleared, ambientPops: 9 }), 0.86);
});
