import type { LongitudinalArchive } from './longitudinalModel';
import type { ReactionTrustState } from './reactionTrust';
import type { FrontierPersistedState } from './types';

export type FrontierArchiveRestorePayload = {
  frontier: FrontierPersistedState;
  reactionTrust: ReactionTrustState;
  longitudinal: LongitudinalArchive;
};

export type FrontierArchiveDomain = 'snapshot' | 'longitudinal' | 'reactionTrust' | 'frontier';

type MaybePromise<T> = T | Promise<T>;
type WriteResult = void | boolean;

export type FrontierArchiveRestoreAdapters = {
  readFrontier: () => MaybePromise<FrontierPersistedState>;
  writeFrontier: (value: FrontierPersistedState) => MaybePromise<WriteResult>;
  readReactionTrust: () => MaybePromise<ReactionTrustState>;
  writeReactionTrust: (value: ReactionTrustState) => MaybePromise<WriteResult>;
  readLongitudinal: () => Promise<LongitudinalArchive>;
  writeLongitudinal: (value: LongitudinalArchive) => MaybePromise<WriteResult>;
};

export type FrontierArchiveRestoreResult = {
  ok: boolean;
  failedDomain?: FrontierArchiveDomain;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  rollbackFailures: Array<Exclude<FrontierArchiveDomain, 'snapshot'>>;
};

async function accepted(result: MaybePromise<WriteResult>): Promise<boolean> {
  return (await result) !== false;
}

async function rollbackDomain(
  domain: Exclude<FrontierArchiveDomain, 'snapshot'>,
  write: () => MaybePromise<WriteResult>,
  failures: Array<Exclude<FrontierArchiveDomain, 'snapshot'>>,
): Promise<void> {
  try {
    if (!await accepted(write())) failures.push(domain);
  } catch {
    failures.push(domain);
  }
}

/**
 * Compensating three-domain restore. IndexedDB, localStorage, and Zustand cannot
 * participate in one native transaction, so claiming true atomicity would be
 * false. Instead we capture all prior states before any mutation, apply durable
 * domains first, and explicitly compensate every domain on failure.
 */
export async function restoreArchiveDomainsWithRollback(
  target: FrontierArchiveRestorePayload,
  adapters: FrontierArchiveRestoreAdapters,
): Promise<FrontierArchiveRestoreResult> {
  let previousFrontier: FrontierPersistedState;
  let previousReactionTrust: ReactionTrustState;
  let previousLongitudinal: LongitudinalArchive;
  try {
    [previousFrontier, previousReactionTrust, previousLongitudinal] = await Promise.all([
      adapters.readFrontier(),
      adapters.readReactionTrust(),
      adapters.readLongitudinal(),
    ]);
  } catch {
    return {
      ok: false,
      failedDomain: 'snapshot',
      rollbackAttempted: false,
      rollbackSucceeded: false,
      rollbackFailures: [],
    };
  }

  let failedDomain: Exclude<FrontierArchiveDomain, 'snapshot'> | undefined;
  try {
    failedDomain = 'longitudinal';
    if (!await accepted(adapters.writeLongitudinal(target.longitudinal))) throw new Error('longitudinal restore rejected');
    failedDomain = 'reactionTrust';
    if (!await accepted(adapters.writeReactionTrust(target.reactionTrust))) throw new Error('reaction trust restore rejected');
    failedDomain = 'frontier';
    if (!await accepted(adapters.writeFrontier(target.frontier))) throw new Error('FRONTIER state restore rejected');
    return { ok: true, rollbackAttempted: false, rollbackSucceeded: true, rollbackFailures: [] };
  } catch {
    const rollbackFailures: Array<Exclude<FrontierArchiveDomain, 'snapshot'>> = [];
    // Restore the visible application state first, then its auxiliary local
    // evidence stores. All three are attempted regardless of earlier failures.
    await rollbackDomain('frontier', () => adapters.writeFrontier(previousFrontier), rollbackFailures);
    await rollbackDomain('reactionTrust', () => adapters.writeReactionTrust(previousReactionTrust), rollbackFailures);
    await rollbackDomain('longitudinal', () => adapters.writeLongitudinal(previousLongitudinal), rollbackFailures);
    return {
      ok: false,
      failedDomain,
      rollbackAttempted: true,
      rollbackSucceeded: rollbackFailures.length === 0,
      rollbackFailures,
    };
  }
}
