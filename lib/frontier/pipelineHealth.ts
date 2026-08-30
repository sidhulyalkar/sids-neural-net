import type { FrontierClientPipelineSnapshot } from './clientPipelineDiagnostics';
import type { FrontierExposureAudit } from './exposureAudit';

export type FrontierPipelineHealthStatus = 'unobserved' | 'stable' | 'watch';
export type FrontierPipelineHealthScope = 'latest-request' | 'longitudinal';
export type FrontierPipelineBoundaryId =
  | 'provenance-admission'
  | 'candidate-retention'
  | 'seen-filter'
  | 'rotation-exclusion'
  | 'rank-admission'
  | 'realm-eligibility'
  | 'slate-selection'
  | 'board-handoff'
  | 'canonical-visibility'
  | 'engagement-after-visible';

export type FrontierPipelineHealthWarning =
  | 'adapter-degradation'
  | 'provenance-pressure'
  | 'candidate-cap-pressure'
  | 'repeated-inventory-pressure'
  | 'rank-collapse'
  | 'selection-collapse'
  | 'low-visibility-evidence';

export type FrontierPipelineBoundary = {
  id: FrontierPipelineBoundaryId;
  label: string;
  scope: FrontierPipelineHealthScope;
  input: number;
  output: number;
  rate: number;
};

export type FrontierPipelineHealth = {
  status: FrontierPipelineHealthStatus;
  observedLatestBoundaries: number;
  observedLongitudinalBoundaries: number;
  latest: FrontierPipelineBoundary[];
  longitudinal: FrontierPipelineBoundary[];
  warnings: FrontierPipelineHealthWarning[];
};

function safeBoundary(
  id: FrontierPipelineBoundaryId,
  label: string,
  scope: FrontierPipelineHealthScope,
  input: number | null | undefined,
  output: number | null | undefined,
): FrontierPipelineBoundary | undefined {
  if (input === null || input === undefined || output === null || output === undefined) return undefined;
  if (!Number.isFinite(input) || !Number.isFinite(output)) return undefined;
  const boundedInput = Math.max(0, Math.floor(input));
  const boundedOutput = Math.max(0, Math.floor(output));
  return {
    id,
    label,
    scope,
    input: boundedInput,
    output: boundedOutput,
    rate: boundedInput > 0 ? Math.min(1, boundedOutput / boundedInput) : 0,
  };
}

function addBoundary(
  target: FrontierPipelineBoundary[],
  boundary: FrontierPipelineBoundary | undefined,
): void {
  if (boundary) target.push(boundary);
}

/**
 * Diagnostic composition only. Latest-request boundaries and longitudinal
 * exposure outcomes intentionally remain separate cohorts. This audit has no
 * ranking authority and makes no causal claim about why a boundary contracted.
 */
export function auditFrontierPipelineHealth(
  client: FrontierClientPipelineSnapshot,
  exposure: FrontierExposureAudit,
): FrontierPipelineHealth {
  const latest: FrontierPipelineBoundary[] = [];
  const longitudinal: FrontierPipelineBoundary[] = [];
  const server = client.server;

  addBoundary(latest, safeBoundary(
    'provenance-admission',
    'Provenance admission',
    'latest-request',
    server?.stages.deduped,
    server?.stages.sourceAdmitted,
  ));
  addBoundary(latest, safeBoundary(
    'candidate-retention',
    'Candidate retention',
    'latest-request',
    server?.stages.sourceAdmitted,
    server?.stages.candidateRetained,
  ));
  addBoundary(latest, safeBoundary(
    'seen-filter',
    'Unseen inventory',
    'latest-request',
    client.received,
    client.unseen,
  ));
  addBoundary(latest, safeBoundary(
    'rotation-exclusion',
    'Rotation-ready inventory',
    'latest-request',
    client.unseen,
    client.rotationReady,
  ));
  addBoundary(latest, safeBoundary(
    'rank-admission',
    'Personalized rank admission',
    'latest-request',
    client.rotationReady,
    client.ranked,
  ));
  addBoundary(latest, safeBoundary(
    'realm-eligibility',
    'Realm eligibility',
    'latest-request',
    client.ranked,
    client.realmEligible,
  ));
  addBoundary(latest, safeBoundary(
    'slate-selection',
    'Slate selection',
    'latest-request',
    client.realmEligible,
    client.selected,
  ));
  addBoundary(latest, safeBoundary(
    'board-handoff',
    'Board handoff',
    'latest-request',
    client.selected,
    client.boardInput,
  ));

  if (exposure.overall.offered > 0) {
    addBoundary(longitudinal, safeBoundary(
      'canonical-visibility',
      'Canonical visibility',
      'longitudinal',
      exposure.overall.offered,
      exposure.overall.visible,
    ));
  }
  if (exposure.overall.visible > 0) {
    addBoundary(longitudinal, safeBoundary(
      'engagement-after-visible',
      'Engagement after visibility',
      'longitudinal',
      exposure.overall.visible,
      exposure.overall.engaged,
    ));
  }

  const warnings: FrontierPipelineHealthWarning[] = [];
  const adapters = server?.adapters;
  if (
    adapters?.attempted !== null && adapters?.attempted !== undefined
    && adapters.failed !== null && adapters.failed !== undefined
    && adapters.attempted >= 4
    && adapters.failed / adapters.attempted >= 0.3
  ) warnings.push('adapter-degradation');

  const provenance = latest.find((stage) => stage.id === 'provenance-admission');
  if (provenance && provenance.input >= 12 && provenance.rate < 0.5) warnings.push('provenance-pressure');

  const retention = latest.find((stage) => stage.id === 'candidate-retention');
  if (retention && retention.input > retention.output && retention.output >= 300) warnings.push('candidate-cap-pressure');

  const unseen = latest.find((stage) => stage.id === 'seen-filter');
  if (unseen && unseen.input >= 16 && unseen.rate < 0.15) warnings.push('repeated-inventory-pressure');

  const rank = latest.find((stage) => stage.id === 'rank-admission');
  if (rank && rank.input >= 8 && rank.output === 0) warnings.push('rank-collapse');

  const selection = latest.find((stage) => stage.id === 'slate-selection');
  if (selection && selection.input >= 8 && selection.output === 0) warnings.push('selection-collapse');

  if (
    exposure.overall.offered >= 24
    && exposure.overall.visibility.value < 0.2
  ) warnings.push('low-visibility-evidence');

  const observed = latest.length + longitudinal.length;
  return {
    status: observed === 0 ? 'unobserved' : warnings.length ? 'watch' : 'stable',
    observedLatestBoundaries: latest.length,
    observedLongitudinalBoundaries: longitudinal.length,
    latest,
    longitudinal,
    warnings,
  };
}
