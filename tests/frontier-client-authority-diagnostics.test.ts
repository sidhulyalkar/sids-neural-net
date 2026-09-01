import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFrontierClientPipeline,
  readFrontierClientPipeline,
  recordFrontierClientAuthority,
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

test('selection publishes its boundary immediately while deferred authority remains unobserved', () => {
  clearFrontierClientPipeline();
  recordFrontierClientFeed({ received: 48, unseen: 45, rotationReady: 44, at: 1 });
  const selectionToken = recordFrontierClientSelection({
    ranked: 42,
    realmEligible: 40,
    selected: 14,
    boardInput: 14,
    at: 2,
  });

  const immediate = readFrontierClientPipeline();
  assert.equal(immediate.at, 2);
  assert.equal(immediate.received, 48);
  assert.equal(immediate.ranked, 42);
  assert.equal(immediate.selected, 14);
  assert.equal(immediate.rankAuthority, null);
  assert.equal(immediate.slateTasteAuthority, null);

  assert.equal(recordFrontierClientAuthority({
    selectionToken,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
  }), true);

  const patched = readFrontierClientPipeline();
  assert.equal(patched.rankAuthority, rankAuthority);
  assert.equal(patched.slateTasteAuthority, slateAuthority);
  clearFrontierClientPipeline();
});

test('a newer selection rejects deferred authority from an older cohort', () => {
  clearFrontierClientPipeline();
  const staleToken = recordFrontierClientSelection({
    ranked: 20,
    realmEligible: 20,
    selected: 14,
    boardInput: 14,
    at: 1,
  });
  const currentToken = recordFrontierClientSelection({
    ranked: 18,
    realmEligible: 16,
    selected: 12,
    boardInput: 12,
    at: 2,
  });

  assert.equal(recordFrontierClientAuthority({
    selectionToken: staleToken,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
  }), false);
  assert.equal(readFrontierClientPipeline().rankAuthority, null);
  assert.equal(readFrontierClientPipeline().ranked, 18);

  assert.equal(recordFrontierClientAuthority({
    selectionToken: currentToken,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
  }), true);
  assert.equal(readFrontierClientPipeline().rankAuthority, rankAuthority);
  clearFrontierClientPipeline();
});

test('a new feed invalidates an outstanding selection token and prior authority', () => {
  clearFrontierClientPipeline();
  const selectionToken = recordFrontierClientSelection({
    ranked: 20,
    realmEligible: 20,
    selected: 14,
    boardInput: 14,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
    at: 1,
  });
  recordFrontierClientFeed({ received: 12, unseen: 10, rotationReady: 9, at: 2 });

  assert.equal(recordFrontierClientAuthority({
    selectionToken,
    rankAuthority,
    slateTasteAuthority: slateAuthority,
  }), false);

  const snapshot = readFrontierClientPipeline();
  assert.equal(snapshot.rankAuthority, null);
  assert.equal(snapshot.slateTasteAuthority, null);
  assert.equal(snapshot.ranked, null);
  assert.equal(snapshot.selected, null);
  clearFrontierClientPipeline();
});
