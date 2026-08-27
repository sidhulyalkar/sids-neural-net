import { FRONTIER_LANE_MAP } from './config';
import { personalTasteRankingPrior } from './personalTaste';
import type { FrontierItem } from './types';

export type FrontierEditorialFamily =
  | 'consequential'
  | 'research'
  | 'builder'
  | 'sports'
  | 'culture'
  | 'leisure';

export type FrontierSlateFamilyDiagnostic = {
  family: FrontierEditorialFamily;
  demand: number;
  targetShare: number;
  selected: number;
  realizedShare: number;
};

const FAMILIES: FrontierEditorialFamily[] = [
  'consequential',
  'research',
  'builder',
  'sports',
  'culture',
  'leisure',
];

const MAX_FAMILY_SHARE = 0.38;
const MAX_LANE_SHARE = 0.24;
const MAX_HOST_ITEMS = 2;
const EXPLICIT_TASTE_THRESHOLD = 0.04;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function frontierEditorialFamily(item: FrontierItem): FrontierEditorialFamily {
  if (item.sourceKind === 'sports_state' || item.sportsState) return 'sports';
  switch (item.lane) {
    case 'must_know':
    case 'world_pulse':
      return 'consequential';
    case 'ml_data':
    case 'ai_frontier':
    case 'neuro_frontier':
    case 'competitions':
    case 'broad_science':
      return 'research';
    case 'methods':
    case 'builder_signal':
    case 'creative_tech':
      return 'builder';
    case 'premier_league':
    case 'world_soccer':
    case 'team_pulse':
    case 'sports':
      return 'sports';
    case 'gaming':
    case 'screen':
    case 'music':
      return 'culture';
    case 'internet_culture':
    case 'life':
    case 'wildcards':
      return 'leisure';
  }
}

function sourceHost(item: FrontierItem): string {
  try {
    return new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    return item.source;
  }
}

function rankSignal(index: number): number {
  // Rank already contains learned preference, context, confidence calibration,
  // freshness and semantic reranking. Keep it the dominant allocation signal,
  // while allowing composition to correct concentrated slates.
  return 1 / (1 + index * 0.11);
}

function candidateUtility(item: FrontierItem, index: number): number {
  const taste = personalTasteRankingPrior(item);
  const genericLeisurePenalty = ['life', 'internet_culture', 'wildcards'].includes(item.lane)
    && taste <= EXPLICIT_TASTE_THRESHOLD
    ? 0.12
    : 0;
  const genericAiPenalty = item.lane === 'ai_frontier' && taste <= EXPLICIT_TASTE_THRESHOLD && item.importance < 0.82
    ? 0.08
    : 0;

  return (
    rankSignal(index) * 0.62
    + item.quality * 0.11
    + item.importance * 0.11
    + clamp(taste, 0, 0.3) * 0.42
    + item.novelty * 0.035
    - genericLeisurePenalty
    - genericAiPenalty
  );
}

function familyDemand(ranked: FrontierItem[], family: FrontierEditorialFamily): number {
  const uniqueHosts = new Set<string>();
  const samples: number[] = [];

  for (let index = 0; index < ranked.length && samples.length < 3; index += 1) {
    const item = ranked[index];
    if (frontierEditorialFamily(item) !== family) continue;
    const host = sourceHost(item);
    if (uniqueHosts.has(host)) continue;
    uniqueHosts.add(host);
    samples.push(candidateUtility(item, index));
  }

  if (!samples.length) return 0;
  const weights = [0.58, 0.28, 0.14];
  return samples.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function familyTargets(ranked: FrontierItem[]): Record<FrontierEditorialFamily, number> {
  const demand = Object.fromEntries(
    FAMILIES.map((family) => [family, familyDemand(ranked, family)])
  ) as Record<FrontierEditorialFamily, number>;
  const total = Object.values(demand).reduce((sum, value) => sum + value, 0);

  if (!total) {
    return Object.fromEntries(FAMILIES.map((family) => [family, 0])) as Record<FrontierEditorialFamily, number>;
  }

  const raw = Object.fromEntries(
    FAMILIES.map((family) => [family, demand[family] / total])
  ) as Record<FrontierEditorialFamily, number>;

  // Caps are composition brakes, not quotas. Redistribute excess once so a
  // research/source flood cannot purchase the entire finite run.
  let excess = 0;
  let uncappedTotal = 0;
  for (const family of FAMILIES) {
    if (raw[family] > MAX_FAMILY_SHARE) excess += raw[family] - MAX_FAMILY_SHARE;
    else uncappedTotal += raw[family];
  }

  return Object.fromEntries(FAMILIES.map((family) => {
    const capped = Math.min(MAX_FAMILY_SHARE, raw[family]);
    const redistributed = raw[family] < MAX_FAMILY_SHARE && uncappedTotal > 0
      ? excess * (raw[family] / uncappedTotal)
      : 0;
    return [family, Math.min(MAX_FAMILY_SHARE, capped + redistributed)];
  })) as Record<FrontierEditorialFamily, number>;
}

function selectedCount(selected: FrontierItem[], family: FrontierEditorialFamily): number {
  return selected.filter((item) => frontierEditorialFamily(item) === family).length;
}

function hasRealm(selected: FrontierItem[], realm: 'learn' | 'play'): boolean {
  return selected.some((item) => FRONTIER_LANE_MAP[item.lane].realm === realm);
}

function bestEligible(
  ranked: FrontierItem[],
  selected: FrontierItem[],
  used: Set<string>,
  limit: number,
  targetShare: Record<FrontierEditorialFamily, number>,
  realm?: 'learn' | 'play',
): FrontierItem | undefined {
  const laneCap = Math.max(2, Math.ceil(limit * MAX_LANE_SHARE));
  const familyCap = Math.max(2, Math.ceil(limit * MAX_FAMILY_SHARE));
  let winner: { item: FrontierItem; score: number } | undefined;

  for (let index = 0; index < ranked.length; index += 1) {
    const item = ranked[index];
    if (used.has(item.id)) continue;
    if (realm && FRONTIER_LANE_MAP[item.lane].realm !== realm) continue;

    const family = frontierEditorialFamily(item);
    const familyCount = selectedCount(selected, family);
    if (familyCount >= familyCap) continue;

    const sameLane = selected.filter((candidate) => candidate.lane === item.lane).length;
    if (sameLane >= laneCap) continue;

    const host = sourceHost(item);
    const sameHost = selected.filter((candidate) => sourceHost(candidate) === host).length;
    if (sameHost >= MAX_HOST_ITEMS) continue;

    // Generic AI gets one easy slot, then must compete as genuinely personalized
    // material. Strong/important AI is not subject to this special brake.
    const taste = personalTasteRankingPrior(item);
    if (
      item.lane === 'ai_frontier'
      && taste <= EXPLICIT_TASTE_THRESHOLD
      && item.importance < 0.82
      && sameLane >= 1
    ) continue;

    const currentShare = selected.length ? familyCount / selected.length : 0;
    const deficit = Math.max(0, targetShare[family] - currentShare);
    const unseenFamily = familyCount === 0 ? 0.105 : 0;
    const laneRepeatPenalty = sameLane * 0.065;
    const hostRepeatPenalty = sameHost * 0.09;
    const score = candidateUtility(item, index)
      + deficit * 0.72
      + unseenFamily
      - laneRepeatPenalty
      - hostRepeatPenalty;

    if (!winner || score > winner.score) winner = { item, score };
  }

  return winner?.item;
}

function add(selected: FrontierItem[], used: Set<string>, item: FrontierItem | undefined): void {
  if (!item || used.has(item.id)) return;
  selected.push(item);
  used.add(item.id);
}

export function selectAdaptiveDailyAllocation(ranked: FrontierItem[], limit: number): FrontierItem[] {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (!boundedLimit || !ranked.length) return [];

  const selected: FrontierItem[] = [];
  const used = new Set<string>();
  const targets = familyTargets(ranked);

  // One truly consequential signal is an editorial interrupt, not a taste quota.
  // It may cross the personalization bubble, but only one gets this authority.
  const consequential = ranked.find((item) => item.lane === 'must_know' || item.importance >= 0.82);
  add(selected, used, consequential);

  // Live sports state is utility. Preserve at most one compact state signal in a
  // normal finite run, but do not let it force out the only other realm in a tiny run.
  if (selected.length < boundedLimit && boundedLimit >= 5) {
    add(selected, used, ranked.find((item) => item.sourceKind === 'sports_state' || Boolean(item.sportsState)));
  }

  // Broad realm coverage is a product invariant. Micro-topics are not. Once the
  // slate is large enough to support variety, give both Brainfood and After Hours
  // a chance if qualified supply exists, then let learned demand own the rest.
  if (boundedLimit >= 4) {
    for (const realm of ['learn', 'play'] as const) {
      if (selected.length >= boundedLimit || hasRealm(selected, realm)) continue;
      add(selected, used, bestEligible(ranked, selected, used, boundedLimit, targets, realm));
    }
  }

  while (selected.length < boundedLimit) {
    const next = bestEligible(ranked, selected, used, boundedLimit, targets);
    if (!next) break;
    add(selected, used, next);
  }

  return selected;
}

export function slateCompositionDiagnostics(
  ranked: FrontierItem[],
  selected: FrontierItem[],
): FrontierSlateFamilyDiagnostic[] {
  const targets = familyTargets(ranked);
  return FAMILIES.map((family) => {
    const count = selectedCount(selected, family);
    return {
      family,
      demand: familyDemand(ranked, family),
      targetShare: targets[family],
      selected: count,
      realizedShare: selected.length ? count / selected.length : 0,
    };
  });
}
