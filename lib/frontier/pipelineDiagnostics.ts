import type { FrontierFeedResponse } from './types';

export const FRONTIER_PIPELINE_DIAGNOSTICS_SCHEMA = 'frontier-pipeline-v1' as const;

export type FrontierPipelineMode =
  | 'snapshot'
  | 'focused-live'
  | 'fresh-live'
  | 'archive-build';

export type FrontierPipelineCoverage = {
  /** True source-mesh acquisition is observable only during live/archive discovery. */
  sourceAcquisition: 'observed' | 'offline-unavailable';
  /** Learned profile state remains browser-local by design. */
  learnedPersonalFitBeforeResponse: 'unobservable-local-profile';
};

export type FrontierPipelineStages = {
  /** Items emitted by source adapters before candidate policy. Null for offline snapshots. */
  sourceAcquired: number | null;
  /** Candidate rows entering the current preparation pass. */
  candidateInput: number;
  plausible: number;
  rightsSafe: number;
  /** Recency is a cold-snapshot revalidation stage, not a live-discovery stage. */
  recent: number | null;
  deduped: number;
  sourceAdmitted: number;
  candidateRetained: number;
  /** English readiness is measured after final pool composition when available. */
  englishReady: number | null;
  responseReady: number;
};

export type FrontierPipelineDrops = {
  implausible: number | null;
  rightsFragile: number | null;
  stale: number | null;
  duplicate: number | null;
  sourceRejected: number | null;
  candidateCap: number | null;
  nonEnglish: number | null;
};

export type FrontierPipelineAdapters = {
  attempted: number | null;
  fulfilled: number | null;
  failed: number | null;
};

export type FrontierPipelineDiagnostics = {
  schema: typeof FRONTIER_PIPELINE_DIAGNOSTICS_SCHEMA;
  mode: FrontierPipelineMode;
  coverage: FrontierPipelineCoverage;
  adapters: FrontierPipelineAdapters;
  stages: FrontierPipelineStages;
  drops: FrontierPipelineDrops;
};

/** Backward-compatible feed shape: every existing consumer can ignore diagnostics. */
export type FrontierObservableFeedResponse = FrontierFeedResponse & {
  pipeline?: FrontierPipelineDiagnostics;
};

export function frontierObservedDrop(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  return Math.max(0, Math.floor(before) - Math.floor(after));
}

export function buildFrontierPipelineDiagnostics(input: {
  mode: FrontierPipelineMode;
  sourceAcquisition: FrontierPipelineCoverage['sourceAcquisition'];
  adapters?: Partial<FrontierPipelineAdapters>;
  stages: FrontierPipelineStages;
}): FrontierPipelineDiagnostics {
  const stages = input.stages;
  const recentBoundary = stages.recent === null ? stages.rightsSafe : stages.recent;
  return {
    schema: FRONTIER_PIPELINE_DIAGNOSTICS_SCHEMA,
    mode: input.mode,
    coverage: {
      sourceAcquisition: input.sourceAcquisition,
      learnedPersonalFitBeforeResponse: 'unobservable-local-profile',
    },
    adapters: {
      attempted: input.adapters?.attempted ?? null,
      fulfilled: input.adapters?.fulfilled ?? null,
      failed: input.adapters?.failed ?? null,
    },
    stages: { ...stages },
    drops: {
      implausible: frontierObservedDrop(stages.candidateInput, stages.plausible),
      rightsFragile: frontierObservedDrop(stages.plausible, stages.rightsSafe),
      stale: stages.recent === null ? null : frontierObservedDrop(stages.rightsSafe, stages.recent),
      duplicate: frontierObservedDrop(recentBoundary, stages.deduped),
      sourceRejected: frontierObservedDrop(stages.deduped, stages.sourceAdmitted),
      candidateCap: frontierObservedDrop(stages.sourceAdmitted, stages.candidateRetained),
      nonEnglish: stages.englishReady === null
        ? null
        : frontierObservedDrop(stages.candidateRetained, stages.englishReady),
    },
  };
}
