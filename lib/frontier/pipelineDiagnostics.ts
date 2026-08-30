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

/**
 * Named observations, not a universal linear funnel. Some modes perform checks
 * in a different order, so a null means that stage was not observed on this path.
 */
export type FrontierPipelineStages = {
  sourceAcquired: number | null;
  candidateInput: number | null;
  plausible: number | null;
  rightsSafe: number | null;
  recent: number | null;
  deduped: number | null;
  sourceAdmitted: number | null;
  candidateRetained: number | null;
  englishReady: number | null;
  responseReady: number;
};

/**
 * Drops are recorded only at the exact code boundary that observed the rejection.
 * They are never reconstructed from two stage counts whose causal ordering may
 * differ between live discovery and cold-snapshot revalidation.
 */
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
  drops?: Partial<FrontierPipelineDrops>;
}): FrontierPipelineDiagnostics {
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
    stages: { ...input.stages },
    drops: {
      implausible: input.drops?.implausible ?? null,
      rightsFragile: input.drops?.rightsFragile ?? null,
      stale: input.drops?.stale ?? null,
      duplicate: input.drops?.duplicate ?? null,
      sourceRejected: input.drops?.sourceRejected ?? null,
      candidateCap: input.drops?.candidateCap ?? null,
      nonEnglish: input.drops?.nonEnglish ?? null,
    },
  };
}
