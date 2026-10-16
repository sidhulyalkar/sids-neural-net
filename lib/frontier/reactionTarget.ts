export type ReactionTargetScore = {
  id: string;
  score: number;
  visibleFraction: number;
};

export type ReactionTargetSelectionConfig = {
  minVisibleFraction: number;
  minScore: number;
  minMargin: number;
};

export const DEFAULT_REACTION_TARGET_SELECTION: ReactionTargetSelectionConfig = {
  minVisibleFraction: 0.34,
  minScore: 0.38,
  minMargin: 0.075,
};

/**
 * Returns a content id only when one rendered card is clearly dominant.
 * Ambiguous viewport states intentionally produce no target and therefore no
 * reaction learning. A false negative is cheaper than assigning a face cue to
 * the wrong recommendation.
 */
export function selectReactionTarget(
  candidates: ReactionTargetScore[],
  config: Partial<ReactionTargetSelectionConfig> = {}
): string | undefined {
  const settings = { ...DEFAULT_REACTION_TARGET_SELECTION, ...config };
  const ranked = candidates
    .filter((candidate) => Number.isFinite(candidate.score) && Number.isFinite(candidate.visibleFraction))
    .sort((left, right) => right.score - left.score);
  const top = ranked[0];
  if (!top || top.visibleFraction < settings.minVisibleFraction || top.score < settings.minScore) return undefined;
  const runnerUp = ranked[1];
  if (runnerUp && top.score - runnerUp.score < settings.minMargin) return undefined;
  return top.id;
}
