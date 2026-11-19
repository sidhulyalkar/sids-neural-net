import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientEngagementAdjustment, frontierMotifForItem } from '../lib/frontier/ambientSprites';
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

test('ornament clicks are capped, exposure-normalized, and never equivalent to explicit likes', () => {
  assert.equal(ambientEngagementAdjustment(history(0,1)),0);
  assert.equal(ambientEngagementAdjustment(history(1,0)),0);
  const clearing=ambientEngagementAdjustment(history(1,1));
  assert(clearing > 0 && clearing <= .002, 'Clear-only taps are weak evidence of article interest');
  const reading=ambientEngagementAdjustment(history(2,1,'2026-11-19T13:00:00Z'));
  assert(reading > clearing && reading <= .018);
  assert.equal(ambientEngagementAdjustment(history(2,99,'2026-11-19T13:00:00Z')), .018);
});
