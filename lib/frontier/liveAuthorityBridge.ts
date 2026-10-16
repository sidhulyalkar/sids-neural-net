import {
  auditFrontierDailyRunTasteAuthority,
  type FrontierDailyRunTasteAuthorityAudit,
} from './dailyRunTasteAuthorityAudit';
import type { FrontierDirectPreferenceEvidenceIndex } from './directPreferenceEvidence';
import type { FrontierPairEvidenceIndex } from './pairEvidence';
import { auditFrontierRankAuthority, type FrontierRankAuthorityAudit } from './rankAuthorityAudit';
import type { FrontierSessionIntent } from './sessionIntent';
import type {
  FrontierBehaviorModel,
  FrontierHistoryEntry,
  FrontierItem,
  FrontierProfile,
} from './types';

export type FrontierLiveAuthorityBridge = {
  schema: 'frontier-live-authority-bridge-v1';
  /** Current realm-ranked candidates audited at the production daily-run limit. */
  candidates: number;
  limit: number;
  rankAuthority: FrontierRankAuthorityAudit;
  /** Whole fixed-taste counterfactual for the canonical-then-expanded Today run. */
  slateTasteAuthority: FrontierDailyRunTasteAuthorityAudit;
};

/**
 * Compute anonymous authority diagnostics from the exact candidate cohort already
 * owned by the browser. This is deliberately a pure bridge: no candidate IDs or
 * content are returned, no scorer/allocator state is mutated, and the audits are
 * never fed back into recommendation behavior.
 *
 * `realmRanked` must be the production-ranked set after current-realm eligibility
 * filtering and before `selectDailyRun`. That keeps the rank and daily-run audits
 * on the same real pre-allocation cohort while preserving their different causal
 * scopes.
 */
export function buildFrontierLiveAuthorityBridge(input: {
  realmRanked: FrontierItem[];
  profile: FrontierProfile;
  history: Record<string, FrontierHistoryEntry>;
  behavior?: FrontierBehaviorModel;
  limit: number;
  now?: Date;
  pairEvidence?: FrontierPairEvidenceIndex;
  sessionIntent?: FrontierSessionIntent;
  directPreferenceEvidence?: FrontierDirectPreferenceEvidenceIndex;
}): FrontierLiveAuthorityBridge {
  const limit = Math.max(0, Math.floor(Number.isFinite(input.limit) ? input.limit : 0));
  const now = input.now ?? new Date();
  const rankAuthority = auditFrontierRankAuthority(
    input.realmRanked,
    input.profile,
    input.history,
    limit,
    now,
    input.behavior,
    input.pairEvidence,
    input.sessionIntent,
    input.directPreferenceEvidence,
  );
  const slateTasteAuthority = auditFrontierDailyRunTasteAuthority(input.realmRanked, limit);

  return {
    schema: 'frontier-live-authority-bridge-v1',
    candidates: input.realmRanked.length,
    limit,
    rankAuthority,
    slateTasteAuthority,
  };
}
