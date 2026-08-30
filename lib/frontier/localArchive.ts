import { frontierLongitudinalStore, type LongitudinalArchive } from './longitudinal';
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
  if (!isObject(value.frontier) || !isObject(value.reactionTrust) || !isObject(value.longitudinal)) return null;
  return value as unknown as FrontierLocalArchive;
}

export async function restoreFrontierLocalArchive(
  archive: FrontierLocalArchive,
  importFrontier: (payload: unknown) => boolean
): Promise<boolean> {
  // Validate every independent persistence surface before mutating the durable
  // IndexedDB timeline. The Zustand import remains authoritative for profile data.
  if (!importFrontier(archive.frontier)) return false;
  if (!importReactionTrustState(archive.reactionTrust)) return false;
  return frontierLongitudinalStore.importArchive(archive.longitudinal);
}
