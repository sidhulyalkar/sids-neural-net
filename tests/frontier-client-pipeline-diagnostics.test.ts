import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearFrontierClientPipeline,
  readFrontierClientPipeline,
  recordFrontierClientFeed,
  recordFrontierClientSelection,
  subscribeFrontierClientPipeline,
} from '../lib/frontier/clientPipelineDiagnostics';
import { buildFrontierPipelineDiagnostics } from '../lib/frontier/pipelineDiagnostics';

test('client pipeline names received, unseen, rotation, rank and board stages explicitly', () => {
  clearFrontierClientPipeline();
  const server = buildFrontierPipelineDiagnostics({
    mode: 'focused-live',
    sourceAcquisition: 'observed',
    stages: {
      sourceAcquired: 100,
      candidateInput: 100,
      plausible: 96,
      rightsSafe: 94,
      recent: null,
      deduped: 90,
      sourceAdmitted: 82,
      candidateRetained: 80,
      englishReady: 76,
      responseReady: 76,
    },
  });

  recordFrontierClientFeed({ server, received: 76, unseen: 52, rotationReady: 49, at: 100 });
  recordFrontierClientSelection({ ranked: 47, realmEligible: 42, selected: 36, boardInput: 38, at: 110 });

  const snapshot = readFrontierClientPipeline();
  assert.equal(snapshot.server, server);
  assert.equal(snapshot.received, 76);
  assert.equal(snapshot.unseen, 52);
  assert.equal(snapshot.rotationReady, 49);
  assert.equal(snapshot.ranked, 47);
  assert.equal(snapshot.realmEligible, 42);
  assert.equal(snapshot.selected, 36);
  assert.equal(snapshot.boardInput, 38);
});

test('new feed invalidates downstream counts instead of carrying stale rank evidence', () => {
  clearFrontierClientPipeline();
  recordFrontierClientFeed({ received: 20, unseen: 18, rotationReady: 18, at: 10 });
  recordFrontierClientSelection({ ranked: 17, realmEligible: 16, selected: 12, boardInput: 12, at: 20 });
  recordFrontierClientFeed({ received: 8, unseen: 3, rotationReady: 2, at: 30 });

  const snapshot = readFrontierClientPipeline();
  assert.equal(snapshot.received, 8);
  assert.equal(snapshot.unseen, 3);
  assert.equal(snapshot.rotationReady, 2);
  assert.equal(snapshot.ranked, null);
  assert.equal(snapshot.selected, null);
  assert.equal(snapshot.boardInput, null);
});

test('client pipeline store is ephemeral and observable without persisting item identity', () => {
  clearFrontierClientPipeline();
  let notifications = 0;
  const unsubscribe = subscribeFrontierClientPipeline(() => { notifications += 1; });
  recordFrontierClientFeed({ received: 6, unseen: 5, rotationReady: 4, at: 1 });
  recordFrontierClientSelection({ ranked: 4, realmEligible: 4, selected: 3, boardInput: 3, at: 2 });
  unsubscribe();

  assert.equal(notifications, 2);
  const serialized = JSON.stringify(readFrontierClientPipeline()).toLowerCase();
  for (const forbidden of ['itemid', 'title', 'summary', 'url', 'query', 'reaction']) {
    assert.equal(serialized.includes(forbidden), false, `client pipeline leaked forbidden field ${forbidden}`);
  }
});
