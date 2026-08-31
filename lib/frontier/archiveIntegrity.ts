import type { LongitudinalArchive } from './longitudinal';
import type { ReactionTrustState } from './reactionTrust';
import type { FrontierPersistedState } from './types';

export type FrontierArchiveRestorePayload = {
  frontier: FrontierPersistedState;
  reactionTrust: ReactionTrustState;
  longitudinal: LongitudinalArchive;
};

export type FrontierArchiveRestoreAdapters = {
  readFrontier: () => FrontierPersistedState;
  writeFrontier: (value: FrontierPersistedState) => boolean;
  readReactionTrust: () => ReactionTrustState;
  writeReactionTrust: (value: ReactionTrustState) => boolean;
  readLongitudinal: () => Promise<LongitudinalArchive>;
  writeLongitudinal: (value: LongitudinalArchive) => Promise<boolean>;
};

export type FrontierArchiveRestoreResult = {
  ok: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
};

export async function restoreArchiveDomainsAtomically(
  target: FrontierArchiveRestorePayload,
  adapters: FrontierArchiveRestoreAdapters,
): Promise<FrontierArchiveRestoreResult> {
  let previousFrontier: FrontierPersistedState;
  let previousReactionTrust: ReactionTrustState;
  let previousLongitudinal: LongitudinalArchive;
  try {
    previousFrontier = adapters.readFrontier();
    previousReactionTrust = adapters.readReactionTrust();
    previousLongitudinal = await adapters.readLongitudinal();
  } catch {
    return { ok: false, rollbackAttempted: false, rollbackSucceeded: false };
  }

  try {
    if (!await adapters.writeLongitudinal(target.longitudinal)) throw new Error('longitudinal restore rejected');
    if (!adapters.writeReactionTrust(target.reactionTrust)) throw new Error('reaction trust restore rejected');
    if (!adapters.writeFrontier(target.frontier)) throw new Error('FRONTIER state restore rejected');
    return { ok: true, rollbackAttempted: false, rollbackSucceeded: true };
  } catch {
    let rollbackSucceeded = true;
    try {
      if (!adapters.writeFrontier(previousFrontier)) rollbackSucceeded = false;
    } catch {
      rollbackSucceeded = false;
    }
    try {
      if (!adapters.writeReactionTrust(previousReactionTrust)) rollbackSucceeded = false;
    } catch {
      rollbackSucceeded = false;
    }
    try {
      if (!await adapters.writeLongitudinal(previousLongitudinal)) rollbackSucceeded = false;
    } catch {
      rollbackSucceeded = false;
    }
    return { ok: false, rollbackAttempted: true, rollbackSucceeded };
  }
}
