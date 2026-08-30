import { directPreferenceSignalsForItem, type FrontierDirectPreferenceEvidenceIndex } from './directPreferenceEvidence';
import { personalInterestConnection } from './interestGraph';
import { personalTasteRankingPrior } from './personalTaste';
import type { FrontierItem, FrontierProfile } from './types';

export type FrontierRecommendationHealthWarning =
  | 'admission-collapse'
  | 'personalized-admission-loss'
  | 'ranking-collapse'
  | 'selection-collapse'
  | 'personalized-selection-loss'
  | 'source-concentration'
  | 'lane-concentration';

export type FrontierRecommendationHealth = {
  counts: {
    acquired: number;
    admitted: number;
    ranked: number;
    selected: number;
    highFitAcquired: number;
    highFitAdmitted: number;
    highFitSelected: number;
  };
  rates: {
    admission: number;
    rankingSurvival: number;
    selection: number;
    highFitAdmission: number;
    highFitSelection: number;
  };
  diversity: {
    sources: number;
    lanes: number;
    maxSourceShare: number;
    maxLaneShare: number;
  };
  warnings: FrontierRecommendationHealthWarning[];
};

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function concentration(values: string[]): { unique: number; maxShare: number } {
  if (!values.length) return { unique: 0, maxShare: 0 };
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const max = Math.max(...counts.values());
  return { unique: counts.size, maxShare: max / values.length };
}

/**
 * Broad pipeline diagnostics, deliberately separate from ranking authority.
 * A candidate is considered high-fit when at least one independent personalized
 * signal is materially positive. This audit never changes candidate order.
 */
export function frontierHighFitCandidate(
  item: FrontierItem,
  profile: FrontierProfile,
  directEvidence?: FrontierDirectPreferenceEvidenceIndex,
): boolean {
  const direct = directPreferenceSignalsForItem(item, profile, directEvidence);
  const connection = personalInterestConnection(item);
  const explicit = personalTasteRankingPrior(item);
  return direct.topicSignal >= 0.1
    || direct.laneAffinity >= 0.16
    || explicit >= 0.08
    || connection.score * connection.confidence >= 0.08;
}

export function auditFrontierRecommendationPipeline(
  stages: {
    acquired: FrontierItem[];
    admitted: FrontierItem[];
    ranked: FrontierItem[];
    selected: FrontierItem[];
  },
  profile: FrontierProfile,
  directEvidence?: FrontierDirectPreferenceEvidenceIndex,
): FrontierRecommendationHealth {
  const highFit = (items: FrontierItem[]) => items.filter((item) => frontierHighFitCandidate(item, profile, directEvidence));
  const highFitAcquired = highFit(stages.acquired).length;
  const highFitAdmitted = highFit(stages.admitted).length;
  const highFitSelected = highFit(stages.selected).length;
  const source = concentration(stages.selected.map((item) => item.source));
  const lane = concentration(stages.selected.map((item) => item.lane));

  const rates = {
    admission: ratio(stages.admitted.length, stages.acquired.length),
    rankingSurvival: ratio(stages.ranked.length, stages.admitted.length),
    selection: ratio(stages.selected.length, stages.ranked.length),
    highFitAdmission: ratio(highFitAdmitted, highFitAcquired),
    highFitSelection: ratio(highFitSelected, highFitAdmitted),
  };

  const warnings: FrontierRecommendationHealthWarning[] = [];
  if (stages.acquired.length >= 4 && stages.admitted.length === 0) warnings.push('admission-collapse');
  if (highFitAcquired >= 2 && rates.highFitAdmission < 0.5) warnings.push('personalized-admission-loss');
  if (stages.admitted.length >= 4 && stages.ranked.length === 0) warnings.push('ranking-collapse');
  if (stages.ranked.length >= 4 && stages.selected.length === 0) warnings.push('selection-collapse');
  if (highFitAdmitted >= 2 && highFitSelected === 0) warnings.push('personalized-selection-loss');
  if (stages.selected.length >= 6 && source.maxShare > 0.5) warnings.push('source-concentration');
  if (stages.selected.length >= 6 && lane.maxShare > 0.6) warnings.push('lane-concentration');

  return {
    counts: {
      acquired: stages.acquired.length,
      admitted: stages.admitted.length,
      ranked: stages.ranked.length,
      selected: stages.selected.length,
      highFitAcquired,
      highFitAdmitted,
      highFitSelected,
    },
    rates,
    diversity: {
      sources: source.unique,
      lanes: lane.unique,
      maxSourceShare: source.maxShare,
      maxLaneShare: lane.maxShare,
    },
    warnings,
  };
}
