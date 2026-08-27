import { FRONTIER_LANE_MAP } from './config';
import { personalTasteRankingPrior } from './personalTaste';
import type { FrontierItem, FrontierLaneId } from './types';

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

type FrontierRealm = 'learn' | 'play';

type CandidateMeta = {
  item: FrontierItem;
  index: number;
  family: FrontierEditorialFamily;
  realm: FrontierRealm;
  sourceBucket: string;
  taste: number;
  utility: number;
};

type SelectionState = {
  selected: CandidateMeta[];
  used: Set<string>;
  familyCounts: Map<FrontierEditorialFamily, number>;
  laneCounts: Map<FrontierLaneId, number>;
  sourceCounts: Map<string, number>;
  realmCounts: Map<FrontierRealm, number>;
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
const MAX_SOURCE_BUCKET_ITEMS = 2;
const EXPLICIT_TASTE_THRESHOLD = 0.04;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function count<K>(map: Map<K, number>, key: K): number {
  return map.get(key) ?? 0;
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

function normalizedSourceLabel(item: FrontierItem): string {
  return item.sourceLabel.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A publisher hostname is usually the right diversity identity, but platforms
 * are ecosystems rather than single editorial desks. Bucket those by a stable
 * sub-source when the URL/provenance exposes one so "two per source" does not
 * accidentally mean "two GitHub repositories on the entire page".
 */
export function frontierSourceBucket(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.split('/').filter(Boolean);

    if (host === 'github.com' && path[0]) return `github.com/${path[0].toLowerCase()}`;
    if (host === 'huggingface.co' && path[0]) return `huggingface.co/${path[0].toLowerCase()}`;

    if (host === 'youtube.com' || host === 'youtu.be') {
      const label = normalizedSourceLabel(item);
      if (label && !['youtube', 'youtube.com'].includes(label)) return `youtube:${label}`;
      return 'youtube';
    }

    if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
      const subreddit = normalizedSourceLabel(item).match(/^r\/([^\s/]+)/)?.[1];
      return subreddit ? `reddit:r/${subreddit}` : 'reddit';
    }

    if (item.sourceKind === 'steam' && path.length) {
      const appIndex = path.findIndex((segment) => segment === 'app');
      const appId = appIndex >= 0 ? path[appIndex + 1] : undefined;
      if (appId) return `steam:app/${appId}`;
    }

    return host || item.source.toLowerCase();
  } catch {
    return item.source.toLowerCase();
  }
}

function rankSignal(index: number): number {
  // Rank already contains learned preference, context, confidence calibration,
  // freshness and semantic reranking. Keep it the dominant allocation signal,
  // while allowing composition to correct concentrated slates.
  return 1 / (1 + index * 0.11);
}

function utilityFromEvidence(item: FrontierItem, index: number, taste: number): number {
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

function prepareCandidates(ranked: FrontierItem[]): CandidateMeta[] {
  // Personal-taste classification performs semantic pattern matching. Compute it
  // exactly once per candidate rather than inside every allocation scan.
  return ranked.map((item, index) => {
    const taste = personalTasteRankingPrior(item);
    return {
      item,
      index,
      family: frontierEditorialFamily(item),
      realm: FRONTIER_LANE_MAP[item.lane].realm,
      sourceBucket: frontierSourceBucket(item),
      taste,
      utility: utilityFromEvidence(item, index, taste),
    };
  });
}

function familyDemand(candidates: CandidateMeta[], family: FrontierEditorialFamily): number {
  const distinctSources = new Set<string>();
  const samples: number[] = [];

  for (const candidate of candidates) {
    if (samples.length >= 3) break;
    if (candidate.family !== family || distinctSources.has(candidate.sourceBucket)) continue;
    distinctSources.add(candidate.sourceBucket);
    samples.push(candidate.utility);
  }

  if (!samples.length) return 0;
  const weights = [0.58, 0.28, 0.14];
  return samples.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function familyDemands(candidates: CandidateMeta[]): Record<FrontierEditorialFamily, number> {
  return Object.fromEntries(
    FAMILIES.map((family) => [family, familyDemand(candidates, family)])
  ) as Record<FrontierEditorialFamily, number>;
}

function familyTargetsFromDemand(
  demand: Record<FrontierEditorialFamily, number>,
): Record<FrontierEditorialFamily, number> {
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

function createSelectionState(): SelectionState {
  return {
    selected: [],
    used: new Set<string>(),
    familyCounts: new Map(),
    laneCounts: new Map(),
    sourceCounts: new Map(),
    realmCounts: new Map(),
  };
}

function addCandidate(state: SelectionState, candidate: CandidateMeta | undefined): void {
  if (!candidate || state.used.has(candidate.item.id)) return;
  state.selected.push(candidate);
  state.used.add(candidate.item.id);
  state.familyCounts.set(candidate.family, count(state.familyCounts, candidate.family) + 1);
  state.laneCounts.set(candidate.item.lane, count(state.laneCounts, candidate.item.lane) + 1);
  state.sourceCounts.set(candidate.sourceBucket, count(state.sourceCounts, candidate.sourceBucket) + 1);
  state.realmCounts.set(candidate.realm, count(state.realmCounts, candidate.realm) + 1);
}

function bestEligible(
  candidates: CandidateMeta[],
  state: SelectionState,
  limit: number,
  targetShare: Record<FrontierEditorialFamily, number>,
  realm?: FrontierRealm,
): CandidateMeta | undefined {
  const laneCap = Math.max(2, Math.ceil(limit * MAX_LANE_SHARE));
  const familyCap = Math.max(2, Math.ceil(limit * MAX_FAMILY_SHARE));
  let winner: { candidate: CandidateMeta; score: number } | undefined;

  for (const candidate of candidates) {
    const { item, family, sourceBucket, taste } = candidate;
    if (state.used.has(item.id)) continue;
    if (realm && candidate.realm !== realm) continue;

    const familyCount = count(state.familyCounts, family);
    if (familyCount >= familyCap) continue;

    const sameLane = count(state.laneCounts, item.lane);
    if (sameLane >= laneCap) continue;

    const sameSource = count(state.sourceCounts, sourceBucket);
    if (sameSource >= MAX_SOURCE_BUCKET_ITEMS) continue;

    // Generic AI gets one easy slot, then must compete as genuinely personalized
    // material. Strong/important AI is not subject to this special brake.
    if (
      item.lane === 'ai_frontier'
      && taste <= EXPLICIT_TASTE_THRESHOLD
      && item.importance < 0.82
      && sameLane >= 1
    ) continue;

    const currentShare = state.selected.length ? familyCount / state.selected.length : 0;
    const deficit = Math.max(0, targetShare[family] - currentShare);
    const unseenFamily = familyCount === 0 ? 0.105 : 0;
    const score = candidate.utility
      + deficit * 0.72
      + unseenFamily
      - sameLane * 0.065
      - sameSource * 0.09;

    if (!winner || score > winner.score) winner = { candidate, score };
  }

  return winner?.candidate;
}

export function selectAdaptiveDailyAllocation(ranked: FrontierItem[], limit: number): FrontierItem[] {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (!boundedLimit || !ranked.length) return [];

  const candidates = prepareCandidates(ranked);
  const state = createSelectionState();
  const targets = familyTargetsFromDemand(familyDemands(candidates));

  // One truly consequential signal is an editorial interrupt, not a taste quota.
  // It may cross the personalization bubble, but only one gets this authority.
  addCandidate(state, candidates.find(({ item }) => item.lane === 'must_know' || item.importance >= 0.82));

  // Live sports state is utility. Preserve at most one compact state signal in a
  // normal finite run, but do not let it force out the only other realm in a tiny run.
  if (state.selected.length < boundedLimit && boundedLimit >= 5) {
    addCandidate(state, candidates.find(({ item }) => item.sourceKind === 'sports_state' || Boolean(item.sportsState)));
  }

  // Broad realm coverage is a product invariant. Micro-topics are not. Once the
  // slate is large enough to support variety, give both Brainfood and After Hours
  // a chance if qualified supply exists, then let learned demand own the rest.
  if (boundedLimit >= 4) {
    for (const realm of ['learn', 'play'] as const) {
      if (state.selected.length >= boundedLimit || count(state.realmCounts, realm) > 0) continue;
      addCandidate(state, bestEligible(candidates, state, boundedLimit, targets, realm));
    }
  }

  while (state.selected.length < boundedLimit) {
    const next = bestEligible(candidates, state, boundedLimit, targets);
    if (!next) break;
    addCandidate(state, next);
  }

  return state.selected.map(({ item }) => item);
}

export function slateCompositionDiagnostics(
  ranked: FrontierItem[],
  selected: FrontierItem[],
): FrontierSlateFamilyDiagnostic[] {
  const candidates = prepareCandidates(ranked);
  const demand = familyDemands(candidates);
  const targets = familyTargetsFromDemand(demand);
  const selectedCounts = new Map<FrontierEditorialFamily, number>();
  for (const item of selected) {
    const family = frontierEditorialFamily(item);
    selectedCounts.set(family, count(selectedCounts, family) + 1);
  }

  return FAMILIES.map((family) => {
    const selectedCount = count(selectedCounts, family);
    return {
      family,
      demand: demand[family],
      targetShare: targets[family],
      selected: selectedCount,
      realizedShare: selected.length ? selectedCount / selected.length : 0,
    };
  });
}
