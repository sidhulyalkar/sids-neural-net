import type { FrontierDailyRunTasteAuthorityAudit } from './dailyRunTasteAuthorityAudit';
import type { FrontierBootstrapTasteCapAudit } from './pipelineDiagnostics';
import type {
  FrontierRankAuthorityAudit,
  FrontierRankAuthorityComponent,
  FrontierRankAuthorityComponentAudit,
} from './rankAuthorityAudit';
import type { FrontierSlateTasteAuthorityAudit } from './slateTasteAuthorityAudit';

export type FrontierPreferenceAuthorityScope =
  | 'server-cap-membership'
  | 'browser-rank-additive-at-observed-gates'
  | 'slate-whole-fixed-taste-policy';

export type FrontierPreferenceAuthoritySignal =
  | 'fixed-taste-active-at-multiple-boundaries';

export type FrontierPreferenceAuthorityServer = {
  scope: 'server-cap-membership';
  observed: boolean;
  audit: FrontierBootstrapTasteCapAudit | null;
};

export type FrontierPreferenceAuthorityRank = {
  scope: 'browser-rank-additive-at-observed-gates';
  observed: boolean;
  audit: FrontierRankAuthorityAudit | null;
  strongestComponent: FrontierRankAuthorityComponentAudit | null;
  fixedTaste: FrontierRankAuthorityComponentAudit | null;
};

export type FrontierPreferenceAuthoritySlateAudit =
  | FrontierSlateTasteAuthorityAudit
  | FrontierDailyRunTasteAuthorityAudit;

export type FrontierPreferenceAuthoritySlate = {
  scope: 'slate-whole-fixed-taste-policy';
  observed: boolean;
  audit: FrontierPreferenceAuthoritySlateAudit | null;
};

export type FrontierPreferenceAuthorityReport = {
  schema: 'frontier-preference-authority-report-v1';
  /**
   * The three boundaries intentionally remain separate counterfactual currencies.
   * This count says only how many fixed-taste boundaries visibly changed their
   * own outcome; it is not an effect size and must never be averaged into one.
   */
  activeFixedTasteBoundaries: number;
  server: FrontierPreferenceAuthorityServer;
  rank: FrontierPreferenceAuthorityRank;
  slate: FrontierPreferenceAuthoritySlate;
  signals: FrontierPreferenceAuthoritySignal[];
};

function membershipChanged(component: FrontierRankAuthorityComponentAudit | null): boolean {
  return Boolean(component && (component.protectedTopK > 0 || component.displacedTopK > 0));
}

function rankComponentActive(component: FrontierRankAuthorityComponentAudit): boolean {
  return component.protectedTopK > 0
    || component.displacedTopK > 0
    || component.meanAbsoluteRankMovement > 1e-9
    || component.maxAbsoluteRankMovement > 0
    || component.meanAbsoluteScoreContribution > 1e-9
    || component.maxAbsoluteScoreContribution > 1e-9;
}

function strongestRankComponent(
  audit: FrontierRankAuthorityAudit | null | undefined,
): FrontierRankAuthorityComponentAudit | null {
  const active = audit?.components.filter(rankComponentActive) ?? [];
  if (!active.length) return null;
  return [...active].sort((left, right) => (
    right.protectedTopK - left.protectedTopK
    || right.displacedTopK - left.displacedTopK
    || right.meanAbsoluteRankMovement - left.meanAbsoluteRankMovement
    || right.maxAbsoluteScoreContribution - left.maxAbsoluteScoreContribution
    || left.component.localeCompare(right.component)
  ))[0] ?? null;
}

function component(
  audit: FrontierRankAuthorityAudit | null | undefined,
  id: FrontierRankAuthorityComponent,
): FrontierRankAuthorityComponentAudit | null {
  return audit?.components.find((entry) => entry.component === id) ?? null;
}

/**
 * Compose existing anonymous audits without changing their causal scope. Server
 * survival, browser additive rank movement and whole-policy slate composition
 * are deliberately not normalized, summed or averaged. The slate input may be
 * the qualified raw allocator audit or the v18 composite daily-run audit; both
 * expose the same aggregate membership contract while naming their causal scope.
 */
export function buildFrontierPreferenceAuthorityReport(input: {
  server?: FrontierBootstrapTasteCapAudit | null;
  rank?: FrontierRankAuthorityAudit | null;
  slate?: FrontierPreferenceAuthoritySlateAudit | null;
}): FrontierPreferenceAuthorityReport {
  const serverAudit = input.server ?? null;
  const rankAudit = input.rank ?? null;
  const slateAudit = input.slate ?? null;
  const fixedTasteRank = component(rankAudit, 'fixed-taste');
  const fixedTasteActive = [
    Boolean(serverAudit && (serverAudit.tasteProtected > 0 || serverAudit.tasteDisplaced > 0)),
    membershipChanged(fixedTasteRank),
    Boolean(slateAudit && (
      slateAudit.protectedByTaste > 0
      || slateAudit.displacedWithoutTaste > 0
      || slateAudit.selectionCountDelta !== 0
    )),
  ].filter(Boolean).length;
  const signals: FrontierPreferenceAuthoritySignal[] = [];
  if (fixedTasteActive >= 2) signals.push('fixed-taste-active-at-multiple-boundaries');

  return {
    schema: 'frontier-preference-authority-report-v1',
    activeFixedTasteBoundaries: fixedTasteActive,
    server: {
      scope: 'server-cap-membership',
      observed: Boolean(serverAudit),
      audit: serverAudit,
    },
    rank: {
      scope: 'browser-rank-additive-at-observed-gates',
      observed: Boolean(rankAudit),
      audit: rankAudit,
      strongestComponent: strongestRankComponent(rankAudit),
      fixedTaste: fixedTasteRank,
    },
    slate: {
      scope: 'slate-whole-fixed-taste-policy',
      observed: Boolean(slateAudit),
      audit: slateAudit,
    },
    signals,
  };
}
