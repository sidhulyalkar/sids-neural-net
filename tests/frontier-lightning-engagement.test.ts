import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeFrontierLightningEngagement } from '../lib/frontier/lightningEngagement';
import { ambientEngagementAdjustment } from '../lib/frontier/ambientSprites';
import type { FrontierHistoryEntry } from '../lib/frontier/types';

const entry=(props:Partial<FrontierHistoryEntry>={}):FrontierHistoryEntry=>({
  item:{id:'demo',title:'Demo'} as FrontierHistoryEntry['item'],
  firstSeenAt:'2026-11-20T00:00:00Z',lastSeenAt:'2026-11-20T00:00:00Z',
  impressions:1,resurfacedCount:0,rewarded:false,
  ambientAppearances:18,ambientPops:0,...props,
});

test('non-game readers have no shot percentage, not a misleading zero percent',()=>{
  assert.deepEqual(summarizeFrontierLightningEngagement([]),{
    articleCount:0,shots:0,hits:0,misses:0,hitRate:null,
    guidedShots:0,guidedHits:0,unguidedShots:0,unguidedHits:0,
    articlesAlsoOpened:0,
  });
});

test('grouped counts separate misses, successes, guided and unguided difficulty',()=>{
  const observed=summarizeFrontierLightningEngagement([
    entry({lightningShots:10,lightningHits:4,lightningGuidedShots:6,
      lightningGuidedHits:3,openedAt:'2026-11-20T00:00:00Z'}),
    entry({lightningShots:6,lightningHits:2,lightningGuidedShots:0,
      lightningGuidedHits:0}),
  ]);
  assert.equal(observed.articleCount,2);
  assert.equal(observed.shots,16);
  assert.equal(observed.hits,6);
  assert.equal(observed.misses,10);
  assert.equal(observed.hitRate,6/16);
  assert.equal(observed.guidedHits,3);
  assert.equal(observed.unguidedShots,10);
  assert.equal(observed.unguidedHits,3);
  assert.equal(observed.articlesAlsoOpened,1);
});

test('gameplay-only outcomes cannot change the existing relevance score',()=>{
  const before=entry({ambientPops:1});
  const after=entry({ambientPops:1,lightningShots:110,lightningHits:22,
    lightningGuidedShots:60,lightningGuidedHits:10});
  assert.equal(ambientEngagementAdjustment(before),ambientEngagementAdjustment(after));
});

test('corrupted or legacy count combinations cannot produce out-of-bounds hit rates',()=>{
  const report=summarizeFrontierLightningEngagement([
    entry({lightningShots:3,lightningHits:99,lightningGuidedShots:50,
      lightningGuidedHits:99}),
    entry({lightningShots:-10,lightningHits:4}),
  ]);
  assert.equal(report.hitRate,1);
  assert.equal(report.guidedShots,3);
  assert.equal(report.unguidedHits,0);
});
