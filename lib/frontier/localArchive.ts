import { restoreArchiveDomainsWithRollback, type FrontierArchiveRestoreResult } from './archiveRestore';
import { parsePrivateFrontierState } from './frontierArchiveStateValidation';
import { parseLongitudinalArchive } from './longitudinalArchiveValidation';
import { frontierLongitudinalStore } from './longitudinalStore';
import type { LongitudinalArchive } from './longitudinalModel';
import {
  getReactionTrustState,
  importReactionTrustState,
  parseReactionTrustState,
  type ReactionTrustState,
} from './reactionTrust';
import { frontierBackup, useFrontierStore, type FrontierStore } from './store';
import type { FrontierPersistedState } from './types';

export type FrontierLocalArchive = {
  schema: 'frontier-local-archive-v1';
  exportedAt: string;
  frontier: FrontierPersistedState;
  reactionTrust: ReactionTrustState;
  longitudinal: LongitudinalArchive;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && Number.isFinite(Date.parse(value));
}

function parseLiveFrontierSnapshot(value: unknown): FrontierPersistedState | null {
  try {
    // The file format is JSON. Canonicalize live Zustand objects before strict
    // validation so harmless in-memory undefined optionals match serialization,
    // while cyclic/non-serializable state fails closed.
    return parsePrivateFrontierState(JSON.parse(JSON.stringify(value)) as unknown);
  } catch {
    return null;
  }
}

export async function createFrontierLocalArchive(
  state: FrontierStore = useFrontierStore.getState(),
): Promise<FrontierLocalArchive> {
  const [longitudinalRaw, reactionTrustRaw] = await Promise.all([
    frontierLongitudinalStore.archive(),
    Promise.resolve(getReactionTrustState()),
  ]);
  const frontier = parseLiveFrontierSnapshot(frontierBackup(state));
  const reactionTrust = parseReactionTrustState(reactionTrustRaw);
  const longitudinal = parseLongitudinalArchive(longitudinalRaw);
  if (!frontier || !reactionTrust || !longitudinal) {
    throw new Error('Current FRONTIER memory failed private archive validation');
  }
  return {
    schema: 'frontier-local-archive-v1',
    exportedAt: new Date().toISOString(),
    frontier,
    reactionTrust,
    longitudinal,
  };
}

export function parseFrontierLocalArchive(value: unknown): FrontierLocalArchive | null {
  if (!isObject(value) || value.schema !== 'frontier-local-archive-v1' || !validIso(value.exportedAt)) return null;
  const frontier = parsePrivateFrontierState(value.frontier);
  const reactionTrust = parseReactionTrustState(value.reactionTrust);
  const longitudinal = parseLongitudinalArchive(value.longitudinal);
  if (!frontier || !reactionTrust || !longitudinal) return null;
  return {
    schema: 'frontier-local-archive-v1',
    exportedAt: value.exportedAt,
    frontier,
    reactionTrust,
    longitudinal,
  };
}

/**
 * Parse first, snapshot all current domains second, then perform a compensating
 * multi-store restore. Arbitrary unknown data never reaches persistence.
 */
export async function restoreFrontierLocalArchive(value: unknown): Promise<FrontierArchiveRestoreResult> {
  const archive = parseFrontierLocalArchive(value);
  if (!archive) {
    return {
      ok: false,
      failedDomain: 'snapshot',
      rollbackAttempted: false,
      rollbackSucceeded: false,
      rollbackFailures: [],
    };
  }

  return restoreArchiveDomainsWithRollback(archive, {
    readFrontier: () => {
      const snapshot = parseLiveFrontierSnapshot(frontierBackup(useFrontierStore.getState()));
      if (!snapshot) throw new Error('Current FRONTIER state could not be snapshotted safely');
      return snapshot;
    },
    writeFrontier: (frontier) => useFrontierStore.getState().importBackup(frontier),
    readReactionTrust: () => {
      const snapshot = parseReactionTrustState(getReactionTrustState());
      if (!snapshot) throw new Error('Current reaction-trust state could not be snapshotted safely');
      return snapshot;
    },
    writeReactionTrust: importReactionTrustState,
    readLongitudinal: async () => {
      const snapshot = parseLongitudinalArchive(await frontierLongitudinalStore.archive());
      if (!snapshot) throw new Error('Current longitudinal state could not be snapshotted safely');
      return snapshot;
    },
    writeLongitudinal: async (longitudinal) => {
      await frontierLongitudinalStore.replaceValidatedArchive(longitudinal);
    },
  });
}
