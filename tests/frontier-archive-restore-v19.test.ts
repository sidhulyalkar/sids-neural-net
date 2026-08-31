import assert from 'node:assert/strict';
import test from 'node:test';
import {
  restoreArchiveDomainsWithRollback,
  type FrontierArchiveRestoreAdapters,
  type FrontierArchiveRestorePayload,
} from '../lib/frontier/archiveRestore';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { parseFrontierLocalArchive } from '../lib/frontier/localArchive';
import type { LongitudinalArchive } from '../lib/frontier/longitudinalModel';
import type { ReactionTrustState } from '../lib/frontier/reactionTrust';
import type { FrontierPersistedState } from '../lib/frontier/types';

const ISO = '2026-08-31T12:00:00.000Z';

function frontier(xp: number): FrontierPersistedState {
  return {
    version: 4,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: {},
    collections: [{ id: 'inbox', name: 'Inbox', itemIds: [], createdAt: ISO }],
    history: {},
    game: { xp, streak: 1, lastActiveDay: '2026-08-31', completedQuestDays: {} },
  };
}

function longitudinal(label: string): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: ISO,
    exposures: [], reactions: [], interactions: [], checkins: [],
    rollups: [{
      id: `rollup-${label}`, batchId: `batch-${label}`, dayKey: '2026-08-31', dimension: 'topic', key: label,
      exposureMs: 60_000, exposures: 1, reactions: 0, explicitInteractions: 0,
      confirmed: 0, contradicted: 0, affinity: 0, interest: 0, surprise: 0, friction: 0,
      confidenceSum: 0, intensitySum: 0, compactedAt: new Date(ISO).getTime(),
    }],
  };
}

function trust(observed: number): ReactionTrustState {
  return { interest: { observed, confirmed: 0, contradicted: 0, confidenceSum: 0 } };
}

function harness(options: { failTargetFrontier?: boolean; failRollbackLongitudinal?: boolean } = {}) {
  const previous = { frontier: frontier(1), reactionTrust: trust(1), longitudinal: longitudinal('previous') };
  const target = { frontier: frontier(99), reactionTrust: trust(2), longitudinal: longitudinal('target') };
  let current = structuredClone(previous) as FrontierArchiveRestorePayload;
  let targetFrontierAttempted = false;
  let rollbackLongitudinalAttempted = false;

  const adapters: FrontierArchiveRestoreAdapters = {
    readFrontier: () => structuredClone(current.frontier),
    writeFrontier: (value) => {
      if (options.failTargetFrontier && value.game.xp === target.frontier.game.xp) {
        targetFrontierAttempted = true;
        return false;
      }
      current.frontier = structuredClone(value);
      return true;
    },
    readReactionTrust: () => structuredClone(current.reactionTrust),
    writeReactionTrust: (value) => {
      current.reactionTrust = structuredClone(value);
      return true;
    },
    readLongitudinal: async () => structuredClone(current.longitudinal),
    writeLongitudinal: async (value) => {
      if (options.failRollbackLongitudinal && value.rollups[0]?.key === 'previous' && targetFrontierAttempted) {
        rollbackLongitudinalAttempted = true;
        return false;
      }
      current.longitudinal = structuredClone(value);
      return true;
    },
  };
  return { previous, target, adapters, current: () => current, rollbackLongitudinalAttempted: () => rollbackLongitudinalAttempted };
}

test('successful three-domain restore applies one validated target composition', async () => {
  const state = harness();
  const result = await restoreArchiveDomainsWithRollback(state.target, state.adapters);
  assert.deepEqual(result, { ok: true, rollbackAttempted: false, rollbackSucceeded: true, rollbackFailures: [] });
  assert.deepEqual(state.current(), state.target);
});

test('late visible-state failure compensates all previously mutated domains', async () => {
  const state = harness({ failTargetFrontier: true });
  const result = await restoreArchiveDomainsWithRollback(state.target, state.adapters);
  assert.equal(result.ok, false);
  assert.equal(result.failedDomain, 'frontier');
  assert.equal(result.rollbackAttempted, true);
  assert.equal(result.rollbackSucceeded, true);
  assert.deepEqual(result.rollbackFailures, []);
  assert.deepEqual(state.current(), state.previous);
});

test('rollback failure is surfaced by exact domain rather than hidden behind a boolean', async () => {
  const state = harness({ failTargetFrontier: true, failRollbackLongitudinal: true });
  const result = await restoreArchiveDomainsWithRollback(state.target, state.adapters);
  assert.equal(result.ok, false);
  assert.equal(result.failedDomain, 'frontier');
  assert.equal(result.rollbackAttempted, true);
  assert.equal(result.rollbackSucceeded, false);
  assert.deepEqual(result.rollbackFailures, ['longitudinal']);
  assert.equal(state.rollbackLongitudinalAttempted(), true);
  assert.equal(state.current().frontier.game.xp, state.previous.frontier.game.xp);
  assert.deepEqual(state.current().reactionTrust, state.previous.reactionTrust);
});

test('snapshot failure mutates nothing and does not pretend rollback occurred', async () => {
  const state = harness();
  const before = structuredClone(state.current());
  const result = await restoreArchiveDomainsWithRollback(state.target, {
    ...state.adapters,
    readReactionTrust: () => { throw new Error('storage blocked'); },
  });
  assert.deepEqual(result, {
    ok: false,
    failedDomain: 'snapshot',
    rollbackAttempted: false,
    rollbackSucceeded: false,
    rollbackFailures: [],
  });
  assert.deepEqual(state.current(), before);
});

test('complete private archive parser fails closed if any domain is malformed', () => {
  const valid = {
    schema: 'frontier-local-archive-v1',
    exportedAt: ISO,
    frontier: frontier(4),
    reactionTrust: trust(2),
    longitudinal: longitudinal('valid'),
  };
  assert.ok(parseFrontierLocalArchive(valid));

  const badTrust = structuredClone(valid) as unknown as Record<string, unknown>;
  ((badTrust.reactionTrust as Record<string, Record<string, unknown>>).interest).confidenceSum = 5;
  assert.equal(parseFrontierLocalArchive(badTrust), null);

  const badLongitudinal = structuredClone(valid) as unknown as Record<string, unknown>;
  ((badLongitudinal.longitudinal as Record<string, unknown>).schema) = 'unknown';
  assert.equal(parseFrontierLocalArchive(badLongitudinal), null);

  const badFrontier = structuredClone(valid) as unknown as Record<string, unknown>;
  ((badFrontier.frontier as Record<string, unknown>).version) = 3;
  assert.equal(parseFrontierLocalArchive(badFrontier), null);
});
