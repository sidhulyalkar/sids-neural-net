import { restoreArchiveDomainsAtomically } from './archiveIntegrity';
import { parsePrivateFrontierState } from './frontierArchiveStateValidation';
import { frontierLongitudinalStore, type LongitudinalArchive } from './longitudinal';
import { parseLongitudinalArchive } from './longitudinalArchiveValidation';
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

export async function createFrontierLocalArchive(state: FrontierStore): Promise<FrontierLocalArchive> {
  const frontier = parsePrivateFrontierState(frontierBackup(state));
  const reactionTrust = parseReactionTrustState(getReactionTrustState());
  const longitudinal = parseLongitudinalArchive(await frontierLongitudinalStore.exportArchive());
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

export async function restoreFrontierLocalArchive(
  archive: FrontierLocalArchive,
  importFrontier: (payload: unknown) => boolean
): Promise<boolean> {
  const result = await restoreArchiveDomainsAtomically(archive, {
    readFrontier: () => {
      const snapshot = parsePrivateFrontierState(frontierBackup(useFrontierStore.getState()));
      if (!snapshot) throw new Error('Current FRONTIER state could not be snapshotted safely');
      return snapshot;
    },
    writeFrontier: (value) => importFrontier(value),
    readReactionTrust: getReactionTrustState,
    writeReactionTrust: importReactionTrustState,
    readLongitudinal: () => frontierLongitudinalStore.exportArchive(),
    writeLongitudinal: (value) => frontierLongitudinalStore.importArchive(value),
  });
  return result.ok;
}
