import type {
  FrontierDecisionOutcome,
  FrontierDecisionPolicyMode,
  FrontierDecisionRecord,
} from './decisionLedger';
import type { FrontierReaction } from './types';

export type FrontierRankBucketId = '1-4' | '5-12' | '13-24' | '25+';
export type FrontierLearningMaturity = 'cold' | 'warming' | 'grounded' | 'rich';

export type FrontierRateInterval = {
  value: number;
  low: number;
  high: number;
  successes: number;
  total: number;
};

export type FrontierExposureSlice = {
  offered: number;
  visible: number;
  engaged: number;
  explicit: number;
  positive: number;
  negative: number;
  neutralReaction: number;
  promoted: number;
  demoted: number;
  unchanged: number;
  synthesized: number;
  visibility: FrontierRateInterval;
  engagementGivenVisible: FrontierRateInterval;
  explicitGivenVisible: FrontierRateInterval;
  positiveGivenVisible: FrontierRateInterval;
  negativeGivenVisible: FrontierRateInterval;
};

export type FrontierExposureAudit = {
  decisions: number;
  sessions: number;
  firstDecisionAt?: number;
  lastDecisionAt?: number;
  ageDays: number;
  maturity: FrontierLearningMaturity;
  evidenceScore: number;
  overall: FrontierExposureSlice;
  byDisplayedRank: Record<FrontierRankBucketId, FrontierExposureSlice>;
  byPolicyMode: Record<FrontierDecisionPolicyMode, FrontierExposureSlice>;
  modeCoverage: FrontierDecisionPolicyMode[];
  causalReady: false;
  causalBlockers: string[];
  warnings: string[];
};

type SliceCounts = Omit<FrontierExposureSlice,
  | 'visibility'
  | 'engagementGivenVisible'
  | 'explicitGivenVisible'
  | 'positiveGivenVisible'
  | 'negativeGivenVisible'
>;

const POSITIVE_REACTIONS = new Set<FrontierReaction>(['up', 'love', 'important', 'surprise', 'useful']);
const NEGATIVE_REACTIONS = new Set<FrontierReaction>(['down', 'meh', 'hide']);
const NEUTRAL_REACTIONS = new Set<FrontierReaction>(['read', 'known', 'later']);

function emptyCounts(): SliceCounts {
  return {
    offered: 0,
    visible: 0,
    engaged: 0,
    explicit: 0,
    positive: 0,
    negative: 0,
    neutralReaction: 0,
    promoted: 0,
    demoted: 0,
    unchanged: 0,
    synthesized: 0,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 95% Wilson score interval. Stable for sparse local evidence and zero counts. */
export function frontierWilsonRate(successes: number, total: number): FrontierRateInterval {
  const n = Math.max(0, Math.floor(total));
  const k = Math.max(0, Math.min(n, Math.floor(successes)));
  if (!n) return { value: 0, low: 0, high: 1, successes: 0, total: 0 };
  const z = 1.959963984540054;
  const p = k / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;
  return {
    value: p,
    low: clamp01(centre - margin),
    high: clamp01(centre + margin),
    successes: k,
    total: n,
  };
}

function finishSlice(counts: SliceCounts): FrontierExposureSlice {
  return {
    ...counts,
    visibility: frontierWilsonRate(counts.visible, counts.offered),
    engagementGivenVisible: frontierWilsonRate(counts.engaged, counts.visible),
    explicitGivenVisible: frontierWilsonRate(counts.explicit, counts.visible),
    positiveGivenVisible: frontierWilsonRate(counts.positive, counts.visible),
    negativeGivenVisible: frontierWilsonRate(counts.negative, counts.visible),
  };
}

function rankBucket(displayedIndex: number): FrontierRankBucketId {
  if (displayedIndex < 4) return '1-4';
  if (displayedIndex < 12) return '5-12';
  if (displayedIndex < 24) return '13-24';
  return '25+';
}

function outcomeSignals(outcome: FrontierDecisionOutcome | undefined) {
  const visible = (outcome?.maxDepth ?? 0) >= 0.55;
  const engaged = Boolean(
    visible
    && (
      (outcome?.maxDwellMs ?? 0) >= 1_500
      || outcome?.expanded
      || outcome?.opened
      || outcome?.saved
      || outcome?.reaction
    )
  );
  const explicit = Boolean(visible && (outcome?.opened || outcome?.saved || outcome?.reaction));
  const positive = Boolean(visible && outcome?.reaction && POSITIVE_REACTIONS.has(outcome.reaction));
  const negative = Boolean(visible && outcome?.reaction && NEGATIVE_REACTIONS.has(outcome.reaction));
  const neutralReaction = Boolean(visible && outcome?.reaction && NEUTRAL_REACTIONS.has(outcome.reaction));
  return { visible, engaged, explicit, positive, negative, neutralReaction };
}

function addExposure(
  counts: SliceCounts,
  decision: FrontierDecisionRecord,
  exposure: FrontierDecisionRecord['exposures'][number],
): void {
  counts.offered += 1;
  const outcome = decision.outcomes.find((entry) => entry.itemId === exposure.itemId);
  const signals = outcomeSignals(outcome);
  if (signals.visible) counts.visible += 1;
  if (signals.engaged) counts.engaged += 1;
  if (signals.explicit) counts.explicit += 1;
  if (signals.positive) counts.positive += 1;
  if (signals.negative) counts.negative += 1;
  if (signals.neutralReaction) counts.neutralReaction += 1;

  if (exposure.upstreamIndex < 0) {
    counts.synthesized += 1;
    return;
  }
  if (exposure.displayedIndex < exposure.upstreamIndex) counts.promoted += 1;
  else if (exposure.displayedIndex > exposure.upstreamIndex) counts.demoted += 1;
  else counts.unchanged += 1;
}

function learningMaturity(
  sessions: number,
  visible: number,
  explicit: number,
): { maturity: FrontierLearningMaturity; score: number } {
  const score = clamp01(
    Math.min(1, sessions / 8) * 0.2
    + Math.min(1, visible / 96) * 0.5
    + Math.min(1, explicit / 24) * 0.3,
  );
  if (sessions < 2 || visible < 12) return { maturity: 'cold', score };
  if (sessions < 3 || visible < 40 || explicit < 4) return { maturity: 'warming', score };
  if (sessions < 6 || visible < 120 || explicit < 12) return { maturity: 'grounded', score };
  return { maturity: 'rich', score };
}

/**
 * Observational audit only. These diagnostics deliberately do not feed ranking.
 * FRONTIER does not yet log the stochastic action propensities required for
 * inverse-propensity scoring or unbiased off-policy evaluation.
 */
export function auditFrontierExposure(
  records: FrontierDecisionRecord[],
  now = Date.now(),
): FrontierExposureAudit {
  const ordered = [...records]
    .filter((record) => Number.isFinite(record.at) && Array.isArray(record.exposures) && Array.isArray(record.outcomes))
    .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));

  const overall = emptyCounts();
  const rankCounts: Record<FrontierRankBucketId, SliceCounts> = {
    '1-4': emptyCounts(),
    '5-12': emptyCounts(),
    '13-24': emptyCounts(),
    '25+': emptyCounts(),
  };
  const modeCounts: Record<FrontierDecisionPolicyMode, SliceCounts> = {
    passive: emptyCounts(),
    search: emptyCounts(),
    explore: emptyCounts(),
  };
  const sessions = new Set<string>();
  const modes = new Set<FrontierDecisionPolicyMode>();

  for (const decision of ordered) {
    sessions.add(decision.sessionId);
    modes.add(decision.policyMode);
    for (const exposure of decision.exposures) {
      addExposure(overall, decision, exposure);
      addExposure(rankCounts[rankBucket(exposure.displayedIndex)], decision, exposure);
      addExposure(modeCounts[decision.policyMode], decision, exposure);
    }
  }

  const overallSlice = finishSlice(overall);
  const maturity = learningMaturity(sessions.size, overall.visible, overall.explicit);
  const firstDecisionAt = ordered[0]?.at;
  const lastDecisionAt = ordered.at(-1)?.lastSeenAt ?? ordered.at(-1)?.at;
  const ageDays = firstDecisionAt === undefined ? 0 : Math.max(0, (now - firstDecisionAt) / 86_400_000);
  const warnings: string[] = [];

  if (overall.offered >= 24 && overallSlice.visibility.value < 0.2) {
    warnings.push('Most offered recommendations have not reached the canonical seen threshold yet.');
  }
  if (overall.visible >= 20 && overall.explicit < 3) {
    warnings.push('Preference evidence is dominated by implicit behavior; explicit feedback is still sparse.');
  }
  if (modes.size === 1 && ordered.length >= 8) {
    warnings.push('Evidence currently covers only one policy mode, so cross-mode comparisons are not informative.');
  }
  if (lastDecisionAt !== undefined && now - lastDecisionAt > 30 * 86_400_000) {
    warnings.push('Decision evidence is stale and should not be treated as current taste without new observations.');
  }

  const causalBlockers = [
    'FRONTIER does not log stochastic action propensities for displayed recommendations.',
    'Passive, search, and explore slates are policy-selected rather than randomized treatment assignments.',
  ];
  if (overall.visible < 100) causalBlockers.push('The local visibility-conditioned sample is still small for stable position-effect estimation.');
  if (sessions.size < 5) causalBlockers.push('Too few independent browser sessions are represented for robust longitudinal estimates.');

  return {
    decisions: ordered.length,
    sessions: sessions.size,
    firstDecisionAt,
    lastDecisionAt,
    ageDays,
    maturity: maturity.maturity,
    evidenceScore: maturity.score,
    overall: overallSlice,
    byDisplayedRank: {
      '1-4': finishSlice(rankCounts['1-4']),
      '5-12': finishSlice(rankCounts['5-12']),
      '13-24': finishSlice(rankCounts['13-24']),
      '25+': finishSlice(rankCounts['25+']),
    },
    byPolicyMode: {
      passive: finishSlice(modeCounts.passive),
      search: finishSlice(modeCounts.search),
      explore: finishSlice(modeCounts.explore),
    },
    modeCoverage: [...modes].sort(),
    causalReady: false,
    causalBlockers,
    warnings,
  };
}
