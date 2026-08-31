import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFrontierClientPipeline,
  readFrontierClientPipeline,
  recordFrontierClientFeed,
  recordFrontierClientSelection,
} from '../lib/frontier/clientPipelineDiagnostics';
import type { FrontierRankAuthorityAudit } from '../lib/frontier/rankAuthorityAudit';
import type { FrontierSlateTasteAuthorityAudit } from '../lib/frontier/slateTasteAuthorityAudit';

const rankAuthority: FrontierRankAuthorityAudit = {
  schema: 'frontier-rank-authority-v1',
  candidates: 20,
  topK: 14,
  components: [],
};

const slateAuthority: FrontierSlateTasteAuthorityAudit = {
  schema: 'frontier-slate-taste-authority-v1',
  causalScope: 'whole-fixed-taste-slate-policy',
  candidates: 20,
  limit: 14,
  productionSelected: 14,
  disabledSelected: 14,
  sharedSelected: 13,
  protectedByTaste: 1,
  displacedWithoutTaste: 1,
  changedMembership: 2,
  selectionCountDelta: 0,
  overlapRate: 13 / 14,
  familyDeltas: [],
};

test('selection records anonymous browser authority alongside the same current pipeline cohort', () => {
  clearFrontierClientPipeline();
  recordFrontierClientFeed({ received: 48, unseen: 45, rotationReady: 44, at: 1 });
  recordFrontierClientSelection({
    ranked: 42,
    realmEligible: 40,
    selected: 14,
    boardInput: 14,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
    at: 2,
  });

  const snapshot = readFrontierClientPipeline();
  assert.equal(snapshot.at, 2);
  assert.equal(snapshot.rankAuthority, rankAuthority);
  assert.equal(snapshot.slateTasteAuthority, slateAuthority);
  assert.equal(snapshot.received, 48);
  clearFrontierClientPipeline();
});

test('a new feed invalidates prior browser authority rather than carrying stale evidence forward', () => {
  clearFrontierClientPipeline();
  recordFrontierClientSelection({
    ranked: 20,
    realmEligible: 20,
    selected: 14,
    boardInput: 14,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
    at: 1,
  });
  recordFrontierClientFeed({ received: 12, unseen: 10, rotationReady: 9, at: 2 });

  const snapshot = readFrontierClientPipeline();
  assert.equal(snapshot.rankAuthority, null);
  assert.equal(snapshot.slateTasteAuthority, null);
  assert.equal(snapshot.ranked, null);
  assert.equal(snapshot.selected, null);
  clearFrontierClientPipeline();
});
