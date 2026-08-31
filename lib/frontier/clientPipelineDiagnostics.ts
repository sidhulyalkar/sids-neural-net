import type { FrontierDailyRunTasteAuthorityAudit } from './dailyRunTasteAuthorityAudit';
import type { FrontierPipelineDiagnostics } from './pipelineDiagnostics';
import type { FrontierRankAuthorityAudit } from './rankAuthorityAudit';
import type { FrontierSlateTasteAuthorityAudit } from './slateTasteAuthorityAudit';

export const FRONTIER_CLIENT_PIPELINE_SCHEMA = 'frontier-client-pipeline-v1' as const;

export type FrontierClientPipelineSnapshot = {
  schema: typeof FRONTIER_CLIENT_PIPELINE_SCHEMA;
  at: number;
  server?: FrontierPipelineDiagnostics;
  /** Cards serialized by the feed route. */
  received: number | null;
  /** Cards remaining after the global seen ledger. */
  unseen: number | null;
  /** Cards remaining after current-rotation exclusion on a fresh request. */
  rotationReady: number | null;
  /** Cards surviving personalized rank admission. */
  ranked: number | null;
  /** Ranked cards eligible for the current realm. */
  realmEligible: number | null;
  /** Cards selected by the daily-run slate allocator. */
  selected: number | null;
  /** Cards handed to SignalBoard before its presentation-layer ordering. */
  boardInput: number | null;
  /** Anonymous, current-cohort rank counterfactual. Never persisted. */
  rankAuthority: FrontierRankAuthorityAudit | null;
  /**
   * Anonymous, current-cohort fixed-taste counterfactual. v17 can carry the raw
   * adaptive allocator audit; v18 live Today cohorts use the composite daily-run
   * audit that also preserves the canonical 14-card prefix. Never persisted.
   */
  slateTasteAuthority: FrontierSlateTasteAuthorityAudit | FrontierDailyRunTasteAuthorityAudit | null;
};

const EMPTY_CLIENT_PIPELINE: FrontierClientPipelineSnapshot = {
  schema: FRONTIER_CLIENT_PIPELINE_SCHEMA,
  at: 0,
  received: null,
  unseen: null,
  rotationReady: null,
  ranked: null,
  realmEligible: null,
  selected: null,
  boardInput: null,
  rankAuthority: null,
  slateTasteAuthority: null,
};

let snapshot: FrontierClientPipelineSnapshot = EMPTY_CLIENT_PIPELINE;
const listeners = new Set<() => void>();

function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function publish(next: FrontierClientPipelineSnapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    try { listener(); } catch { /* diagnostics must never affect recommendation behavior */ }
  }
}

export function recordFrontierClientFeed(input: {
  server?: FrontierPipelineDiagnostics;
  received: number;
  unseen: number;
  rotationReady: number;
  at?: number;
}): void {
  publish({
    schema: FRONTIER_CLIENT_PIPELINE_SCHEMA,
    at: input.at ?? Date.now(),
    server: input.server,
    received: safeCount(input.received),
    unseen: safeCount(input.unseen),
    rotationReady: safeCount(input.rotationReady),
    ranked: null,
    realmEligible: null,
    selected: null,
    boardInput: null,
    rankAuthority: null,
    slateTasteAuthority: null,
  });
}

export function recordFrontierClientSelection(input: {
  ranked: number;
  realmEligible: number;
  selected: number;
  boardInput: number;
  rankAuthority?: FrontierRankAuthorityAudit | null;
  slateTasteAuthority?: FrontierSlateTasteAuthorityAudit | FrontierDailyRunTasteAuthorityAudit | null;
  at?: number;
}): void {
  publish({
    ...snapshot,
    at: input.at ?? Date.now(),
    ranked: safeCount(input.ranked),
    realmEligible: safeCount(input.realmEligible),
    selected: safeCount(input.selected),
    boardInput: safeCount(input.boardInput),
    rankAuthority: input.rankAuthority ?? null,
    slateTasteAuthority: input.slateTasteAuthority ?? null,
  });
}

export function readFrontierClientPipeline(): FrontierClientPipelineSnapshot {
  return snapshot;
}

export function readFrontierClientPipelineServer(): FrontierClientPipelineSnapshot {
  return EMPTY_CLIENT_PIPELINE;
}

export function subscribeFrontierClientPipeline(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearFrontierClientPipeline(): void {
  publish(EMPTY_CLIENT_PIPELINE);
}
