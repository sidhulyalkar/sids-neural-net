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
 * Drops are recorded only when their causal boundary is known. Live request
 * modes have one fixed preparation order; snapshot/archive callers with different
 * ordering must provide their observed drops explicitly.
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

export type FrontierBootstrapTasteCapAudit = {
  /** Source-admitted candidates eligible for the fixed-size server cap. */
  eligible: number;
  cap: number;
  retained: number;
  /** Candidates shared with a baseScore-only cap counterfactual. */
  sharedWithBaseScore: number;
  /** Current candidates kept only because the fixed bootstrap taste prior changed cap membership. */
  tasteProtected: number;
  /** Base-score candidates displaced by those protected candidates. */
  tasteDisplaced: number;
  overlapRate: number;
};

export type FrontierPipelineAuthorityDiagnostics = {
  /**
   * Instrumentation-only static counterfactual. This measures cap membership,
   * not user utility and not the browser's learned preference model.
   */
  bootstrapTasteCandidateCap: FrontierBootstrapTasteCapAudit | null;
};

export type FrontierPipelineDiagnostics = {
  schema: typeof FRONTIER_PIPELINE_DIAGNOSTICS_SCHEMA;
  mode: FrontierPipelineMode;
  coverage: FrontierPipelineCoverage;
  adapters: FrontierPipelineAdapters;
  stages: FrontierPipelineStages;
  drops: FrontierPipelineDrops;
  authority: FrontierPipelineAuthorityDiagnostics;
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
  authority?: Partial<FrontierPipelineAuthorityDiagnostics>;
}): FrontierPipelineDiagnostics {
  const live = input.mode === 'focused-live' || input.mode === 'fresh-live';
  const liveDrops: FrontierPipelineDrops = live
    ? {
        implausible: frontierObservedDrop(input.stages.candidateInput, input.stages.plausible),
        rightsFragile: frontierObservedDrop(input.stages.plausible, input.stages.rightsSafe),
        stale: null,
        duplicate: frontierObservedDrop(input.stages.rightsSafe, input.stages.deduped),
        sourceRejected: frontierObservedDrop(input.stages.deduped, input.stages.sourceAdmitted),
        candidateCap: frontierObservedDrop(input.stages.sourceAdmitted, input.stages.candidateRetained),
        nonEnglish: frontierObservedDrop(input.stages.candidateRetained, input.stages.englishReady),
      }
    : {
        implausible: null,
        rightsFragile: null,
        stale: null,
        duplicate: null,
        sourceRejected: null,
        candidateCap: null,
        nonEnglish: null,
      };

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
      implausible: input.drops?.implausible ?? liveDrops.implausible,
      rightsFragile: input.drops?.rightsFragile ?? liveDrops.rightsFragile,
      stale: input.drops?.stale ?? liveDrops.stale,
      duplicate: input.drops?.duplicate ?? liveDrops.duplicate,
      sourceRejected: input.drops?.sourceRejected ?? liveDrops.sourceRejected,
      candidateCap: input.drops?.candidateCap ?? liveDrops.candidateCap,
      nonEnglish: input.drops?.nonEnglish ?? liveDrops.nonEnglish,
    },
    authority: {
      bootstrapTasteCandidateCap: input.authority?.bootstrapTasteCandidateCap ?? null,
    },
  };
}
