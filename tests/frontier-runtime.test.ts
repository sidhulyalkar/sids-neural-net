import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frontierRuntimeHealthSnapshot,
  publishFrontierRuntimeHealth,
  resetFrontierRuntimeHealth,
} from '../lib/frontier/runtime/runtimeHealth';
import {
  boundedPeerEngagementDelta,
  pnCounterValueExcludingActor,
} from '../lib/frontier/sync/meshEngagement';
import { incrementPnCounter, type PnCounter } from '../lib/frontier/sync/meshSync';

test('runtime health reports degraded and failed subsystems without treating idle opt-in paths as failures', () => {
  resetFrontierRuntimeHealth();
  publishFrontierRuntimeHealth('mesh', 'idle', { at: 1 });
  publishFrontierRuntimeHealth('sequence-model', 'ready', { at: 2 });
  publishFrontierRuntimeHealth('vector-archive', 'degraded', { at: 3, message: 'timeout', consecutiveFailures: 1 });

  let snapshot = frontierRuntimeHealthSnapshot();
  assert.equal(snapshot.overall, 'degraded');
  assert.deepEqual(snapshot.degraded, ['vector-archive']);

  publishFrontierRuntimeHealth('signal-processor', 'failed', { at: 4, consecutiveFailures: 2 });
  snapshot = frontierRuntimeHealthSnapshot();
  assert.equal(snapshot.overall, 'failed');
  assert.deepEqual(snapshot.degraded.sort(), ['signal-processor', 'vector-archive']);
  resetFrontierRuntimeHealth();
});

test('peer engagement excludes evidence already authored on the receiving browser', () => {
  let counter: PnCounter = { positive: {}, negative: {} };
  counter = incrementPnCounter(counter, 'desktop', 2);
  counter = incrementPnCounter(counter, 'desktop', -0.25);
  counter = incrementPnCounter(counter, 'phone', 1.5);
  counter = incrementPnCounter(counter, 'phone', -0.5);
  counter = incrementPnCounter(counter, 'tablet', -0.25);

  assert.ok(Math.abs(pnCounterValueExcludingActor(counter, 'desktop') - 0.75) < 1e-9);
  assert.ok(Math.abs(pnCounterValueExcludingActor(counter, 'phone') - 1.5) < 1e-9);
});

test('peer engagement is imported conservatively and remains directionally correct', () => {
  assert.ok(Math.abs(boundedPeerEngagementDelta(2, 1) - 0.35) < 1e-9);
  assert.ok(Math.abs(boundedPeerEngagementDelta(-3, 0) + 1.05) < 1e-9);
  assert.equal(boundedPeerEngagementDelta(100, 0), 1.5);
  assert.equal(boundedPeerEngagementDelta(-100, 0), -1.5);
  assert.equal(boundedPeerEngagementDelta(Number.NaN, 0), 0);
});
