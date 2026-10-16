import type { FrontierBootstrapTasteCapAudit } from './pipelineDiagnostics';
import type { FrontierItem } from './types';

function boundedCap(cap: number): number {
  return Math.max(0, Math.floor(Number.isFinite(cap) ? cap : 0));
}

/**
 * Compare the already-selected server candidate set with a baseScore-only cap.
 *
 * `retained` is the real candidate set produced by the existing bootstrap taste
 * priority. This function never changes that set and returns counts only. Item
 * identities are used transiently for set equality and never leave the server
 * diagnostic boundary.
 */
export function auditBootstrapTasteCandidateCap(
  eligible: FrontierItem[],
  retained: FrontierItem[],
  cap: number,
): FrontierBootstrapTasteCapAudit {
  const limit = Math.min(boundedCap(cap), eligible.length);
  const baseline = [...eligible]
    .sort((left, right) => right.baseScore - left.baseScore)
    .slice(0, limit);
  const actual = retained.slice(0, limit);
  const baselineIds = new Set(baseline.map((item) => item.id));
  const actualIds = new Set(actual.map((item) => item.id));
  const sharedWithBaseScore = actual.reduce(
    (count, item) => count + (baselineIds.has(item.id) ? 1 : 0),
    0,
  );
  const tasteProtected = actual.reduce(
    (count, item) => count + (baselineIds.has(item.id) ? 0 : 1),
    0,
  );
  const tasteDisplaced = baseline.reduce(
    (count, item) => count + (actualIds.has(item.id) ? 0 : 1),
    0,
  );

  return {
    eligible: eligible.length,
    cap: boundedCap(cap),
    retained: actual.length,
    sharedWithBaseScore,
    tasteProtected,
    tasteDisplaced,
    overlapRate: actual.length ? sharedWithBaseScore / actual.length : 1,
  };
}
