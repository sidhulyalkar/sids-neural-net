import { frontierLongitudinalStore, type LongitudinalArchive } from './longitudinal';
import { parseFrontierPersistedState } from './memoryMerge';
import { getReactionTrustState, importReactionTrustState, type ReactionTrustState } from './reactionTrust';
import { frontierBackup, type FrontierStore } from './store';
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

function validLongitudinalArchive(value: unknown): value is LongitudinalArchive {
  if (!isObject(value) || value.schema !== 'frontier-longitudinal-v1') return false;
  return Array.isArray(value.exposures)
    && Array.isArray(value.reactions)
    && Array.isArray(value.interactions)
    && Array.isArray(value.checkins)
    && Array.isArray(value.rollups);
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
  if (!isObject(value) || value.schema !== 'frontier-local-archive-v1') return null;
  const frontier = parseFrontierPersistedState(value.frontier);
  if (!frontier || !isObject(value.reactionTrust) || !validLongitudinalArchive(value.longitudinal)) return null;
  return {
    schema: 'frontier-local-archive-v1',
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    frontier,
    reactionTrust: value.reactionTrust as ReactionTrustState,
    longitudinal: value.longitudinal,
  };
}

export async function restoreFrontierLocalArchive(
  archive: FrontierLocalArchive,
  importFrontier: (payload: unknown) => boolean
): Promise<boolean> {
  // IndexedDB is the most failure-prone persistence surface, so restore it first.
  // The parser has already validated the Zustand payload and archive shape.
  const longitudinal = await frontierLongitudinalStore.importArchive(archive.longitudinal);
  if (!longitudinal) return false;
  if (!importReactionTrustState(archive.reactionTrust)) return false;
  return importFrontier(archive.frontier);
}
