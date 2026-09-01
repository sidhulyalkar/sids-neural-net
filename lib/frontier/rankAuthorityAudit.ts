import { buildConnectionExposureIndex } from './connectionPortfolio';
import { buildDirectPreferenceEvidenceIndex, type FrontierDirectPreferenceEvidenceIndex } from './directPreferenceEvidence';
import { buildPairEvidenceIndex, type FrontierPairEvidenceIndex } from './pairEvidence';
import {
  clamp,
  frontierRankScoreBreakdown,
  sumFrontierPersonalizedScoreComponents,
  type FrontierPersonalizedScoreComponents,
  type FrontierRankScoreBreakdown,
} from './scoring';
import { buildSessionIntent, type FrontierSessionIntent } from './sessionIntent';
import type {
  FrontierBehaviorModel,
  FrontierHistoryEntry,
  FrontierItem,
  FrontierProfile,
} from './types';

export type FrontierRankAuthorityComponent =
  | 'fixed-taste'
  | 'direct-preference-additive'
  | 'pair-connection-additive'
  | 'implicit-behavior'
  | 'session-intent'
  | 'exploration';

export type FrontierRankAuthorityComponentAudit = {
  component: FrontierRankAuthorityComponent;
  candidates: number;
  topK: number;
  sharedTopK: number;
  protectedTopK: number;
  displacedTopK: number;
  overlapRate: number;
  meanAbsoluteRankMovement: number;
  maxAbsoluteRankMovement: number;
  meanAbsoluteScoreContribution: number;
  maxAbsoluteScoreContribution: number;
};

export type FrontierRankAuthorityAudit = {
  schema: 'frontier-rank-authority-v1';
  candidates: number;
  topK: number;
  components: FrontierRankAuthorityComponentAudit[];
};

type ComponentSpec = {
  id: FrontierRankAuthorityComponent;
  omitted: readonly (keyof FrontierPersonalizedScoreComponents)[];
  omitPortfolio?: boolean;
};

type ScoredCandidate = {
  item: FrontierItem;
  currentIndex: number;
  breakdown: FrontierRankScoreBreakdown;
};

const COMPONENT_SPECS: readonly ComponentSpec[] = [
  { id: 'fixed-taste', omitted: ['tastePrior'] },
  { id: 'direct-preference-additive', omitted: ['laneAffinity', 'topicSignal', 'sourceAffinity'] },
  { id: 'pair-connection-additive', omitted: ['pairSignal', 'connectionPrior'], omitPortfolio: true },
  { id: 'implicit-behavior', omitted: ['learnedBehavior'] },
  { id: 'session-intent', omitted: ['sessionIntent'] },
  { id: 'exploration', omitted: ['curiosity', 'exploration'] },
];

function boundedTopK(topK: number, candidates: number): number {
  return Math.min(candidates, Math.max(0, Math.floor(Number.isFinite(topK) ? topK : 0)));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function counterfactualScore(candidate: ScoredCandidate, spec: ComponentSpec): number {
  const omitted = new Set(spec.omitted);
  const personalizedRaw = sumFrontierPersonalizedScoreComponents(
    candidate.breakdown.personalized.components,
    omitted,
  );
  const personalized = clamp(personalizedRaw, -1, 1.5);
  const portfolio = spec.omitPortfolio ? 0 : candidate.breakdown.connectionPortfolio;
  return personalized + portfolio;
}

/**
 * Measures additive rank leverage while holding every upstream interaction gate
 * at its observed value. For example, direct preference can suppress fixed taste
 * before the numeric components are formed; this audit does not claim to undo
 * that causal interaction. It asks the narrower question: how much does each
 * realized additive contribution move the current eligible candidate set?
 *
 * `ranked` must be the production-ranked eligible set. Hidden/source-rejected
 * candidates are intentionally outside this audit so eligibility logic is not
 * duplicated in a diagnostic implementation.
 */
export function auditFrontierRankAuthority(
  ranked: FrontierItem[],
  profile: FrontierProfile,
  history: Record<string, FrontierHistoryEntry>,
  topK = 48,
  now = new Date(),
  behavior?: FrontierBehaviorModel,
  pairEvidence: FrontierPairEvidenceIndex = buildPairEvidenceIndex(history, now),
  sessionIntent: FrontierSessionIntent = buildSessionIntent(history, now),
  directPreferenceEvidence: FrontierDirectPreferenceEvidenceIndex = buildDirectPreferenceEvidenceIndex(history, now),
): FrontierRankAuthorityAudit {
  const limit = boundedTopK(topK, ranked.length);
  const connectionExposure = buildConnectionExposureIndex(history, now);
  const candidates: ScoredCandidate[] = ranked.map((item, currentIndex) => ({
    item,
    currentIndex,
    breakdown: frontierRankScoreBreakdown(
      item,
      profile,
      history[item.id],
      connectionExposure,
      now,
      behavior,
      pairEvidence,
      sessionIntent,
      directPreferenceEvidence,
    ),
  }));
  const currentTop = new Set(candidates.slice(0, limit).map(({ item }) => item.id));

  const components = COMPONENT_SPECS.map((spec): FrontierRankAuthorityComponentAudit => {
    const adjusted = candidates
      .map((candidate) => ({ candidate, score: counterfactualScore(candidate, spec) }))
      .sort((left, right) => right.score - left.score || left.candidate.currentIndex - right.candidate.currentIndex);
    const adjustedTop = new Set(adjusted.slice(0, limit).map(({ candidate }) => candidate.item.id));
    const adjustedRanks = new Map(adjusted.map(({ candidate }, index) => [candidate.item.id, index]));
    const sharedTopK = candidates
      .slice(0, limit)
      .reduce((count, { item }) => count + (adjustedTop.has(item.id) ? 1 : 0), 0);
    const rankMovements = candidates.map(({ item, currentIndex }) => (
      Math.abs((adjustedRanks.get(item.id) ?? currentIndex) - currentIndex)
    ));
    const scoreContributions = candidates.map((candidate) => (
      Math.abs(candidate.breakdown.score - counterfactualScore(candidate, spec))
    ));

    return {
      component: spec.id,
      candidates: candidates.length,
      topK: limit,
      sharedTopK,
      protectedTopK: Math.max(0, currentTop.size - sharedTopK),
      displacedTopK: Math.max(0, adjustedTop.size - sharedTopK),
      overlapRate: limit ? sharedTopK / limit : 1,
      meanAbsoluteRankMovement: mean(rankMovements),
      maxAbsoluteRankMovement: rankMovements.length ? Math.max(...rankMovements) : 0,
      meanAbsoluteScoreContribution: mean(scoreContributions),
      maxAbsoluteScoreContribution: scoreContributions.length ? Math.max(...scoreContributions) : 0,
    };
  });

  return {
    schema: 'frontier-rank-authority-v1',
    candidates: candidates.length,
    topK: limit,
    components,
  };
}
