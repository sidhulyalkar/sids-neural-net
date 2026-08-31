import { restoreArchiveDomainsAtomically } from './archiveIntegrity';
import { frontierLongitudinalStore, type LongitudinalArchive } from './longitudinal';
import { parseLongitudinalArchive } from './longitudinalArchiveValidation';
import { parseFrontierPersistedState } from './memoryMerge';
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
  return {
    schema: 'frontier-local-archive-v1',
    exportedAt: new Date().toISOString(),
    frontier: frontierBackup(state),
    reactionTrust: getReactionTrustState(),
    longitudinal: await frontierLongitudinalStore.exportArchive(),
  };
}

export function parseFrontierLocalArchive(value: unknown): FrontierLocalArchive | null {
  if (!isObject(value) || value.schema !== 'frontier-local-archive-v1' || !validIso(value.exportedAt)) return null;
  const frontier = parseFrontierPersistedState(value.frontier);
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
    readFrontier: () => frontierBackup(useFrontierStore.getState()),
    writeFrontier: (value) => importFrontier(value),
    readReactionTrust: getReactionTrustState,
    writeReactionTrust: importReactionTrustState,
    readLongitudinal: () => frontierLongitudinalStore.exportArchive(),
    writeLongitudinal: (value) => frontierLongitudinalStore.importArchive(value),
  });
  return result.ok;
}
