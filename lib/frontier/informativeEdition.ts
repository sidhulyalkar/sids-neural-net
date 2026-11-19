import type { FrontierItem } from './types';
import { buildFrontierSourceBrief } from './sourceBrief';

/** A weak, explainable signal of how much source material an article offers.
 * It is NOT an importance estimate, truthfulness classifier, or paper score.
 * Existing source admission, personalization and diverse slate allocation
 * remain authoritative; this can only perturb nearby items in their order.
 */
const PRIMARY_SOURCE_KINDS = new Set(['arxiv', 'biorxiv', 'medrxiv', 'openreview', 'github', 'nasa']);
const POPULARITY_METRIC = /^(?:(?:hf|github|youtube|reddit|hackernews)\s*)?(?:stars?|forks?|points?|comments?|upvotes?|downvotes?|likes?|favorites?|watchers?|followers?|subscribers?|views?|citations?|downloads?|live|final|upcoming)$/i;
const INFORMATION_WEIGHT = 4;

function bounded01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Only source-reported, non-popularity measurements are eligible for editorial display. */
export function frontierReportedMetrics(item: FrontierItem) {
  return (item.metrics ?? []).filter((metric) =>
    Boolean(metric.label.trim() && metric.value.trim()) &&
    !POPULARITY_METRIC.test(metric.label.replace(/[_-]/g, ' ').trim()));
}

export type FrontierInformationValue = {
  value: number;
  reasons: string[];
};

export function frontierInformationValue(item: FrontierItem): FrontierInformationValue {
  const reasons: string[] = [];
  const lead = buildFrontierSourceBrief(item.summary, item.sourceKind).lead;
  // Source context length is capped: boilerplate cannot accrue endless value.
  const contextualDetail = bounded01(Math.max(0, lead.trim().length - 65) / 260);
  const measurements = frontierReportedMetrics(item);
  const primaryArtifacts = (item.artifacts ?? []).filter((artifact) =>
    Boolean(artifact.label.trim()) &&
    ['repository', 'benchmark', 'formula', 'release'].includes(artifact.kind));
  const publisherFigures = item.figures?.filter((figure) => figure.url && figure.alt)?.length ?? 0;
  const structuredEvidence = bounded01(
    (measurements.length ? .55 : 0) +
    (primaryArtifacts.length ? .45 : 0) +
    (publisherFigures ? .18 : 0) +
    (item.sportsState ? .5 : 0) +
    (item.convergence?.members.length ? .18 : 0)
  );

  if (measurements.length) reasons.push('Reported numbers');
  if (primaryArtifacts.length) reasons.push('Primary references');
  if (item.sportsState) reasons.push('Structured match data');
  if (publisherFigures) reasons.push('Source figures');
  if (item.convergence?.members.length) reasons.push('Related sources');
  if (contextualDetail >= .45) reasons.push('Detailed context');

  const isPrimary = PRIMARY_SOURCE_KINDS.has(item.sourceKind);
  // This deliberately gives only a modest boost to primary-source provenance;
  // niche discoveries and source-rich sports or culture stories still compete.
  const value =
    .26 * bounded01(item.quality) +
    .19 * bounded01(item.importance) +
    .09 * bounded01(item.novelty) +
    .14 * contextualDetail +
    .24 * structuredEvidence +
    .08 * (isPrimary ? 1 : .35);
  return { value: bounded01(value), reasons: reasons.slice(0, 3) };
}

/** Local bounded promotion, applied BEFORE the existing diverse slate selector.
 * Highest possible displacement comes from a four-slot adjacent comparison.
 * No separate category quota or preference score is overwritten here.
 */
export function rerankFrontierForInformation(ranked: FrontierItem[]): FrontierItem[] {
  return ranked
    .map((item, order) => ({ item, order, value: frontierInformationValue(item).value }))
    .sort((a, b) => (a.order - INFORMATION_WEIGHT * a.value) -
      (b.order - INFORMATION_WEIGHT * b.value) || a.order - b.order)
    .map(({ item }) => item);
}
