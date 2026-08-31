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

export type FrontierSlateTastePolicy = 'production' | 'disabled';

export type FrontierAdaptiveSlateOptions = {
  tastePolicy?: FrontierSlateTastePolicy;
};

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
  allocationUtility: number;
  isUtility: boolean;
};

type SelectionState = {
  selected: CandidateMeta[];
  used: Set<string>;
  editorialSelectedCount: number;
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
const RERANK_WINDOW_MULTIPLIER = 1.5;
const MIN_RERANK_EXTRA = 6;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function count<K>(map: Map<K, number>, key: K): number {
  return map.get(key) ?? 0;
}

export function isFrontierUtilityItem(item: FrontierItem): boolean {
  return item.sourceKind === 'sports_state' || Boolean(item.sportsState);
}

export function frontierEditorialFamily(item: FrontierItem): FrontierEditorialFamily {
  if (isFrontierUtilityItem(item)) return 'sports';
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

/**
 * Composition is a local reranker, not a second recommendation engine. Keep its
 * authority inside a bounded neighborhood around the learned top-N so diversity
 * cannot resurrect deeply buried interests. A canonical 14-card run may inspect
 * the first 21 ranked candidates; a 48-card deep browse may inspect the first 72.
 */
export function frontierRerankWindowSize(limit: number, candidateCount: number): number {
  const boundedLimit = Math.max(0, Math.floor(limit));
  const boundedCount = Math.max(0, Math.floor(candidateCount));
  if (!boundedLimit || !boundedCount) return 0;
  const desired = Math.max(
    boundedLimit,
    boundedLimit + MIN_RERANK_EXTRA,
    Math.ceil(boundedLimit * RERANK_WINDOW_MULTIPLIER),
  );
  return Math.min(boundedCount, desired);
}

function rankSignal(index: number): number {
  // Rank already contains learned preference, context, confidence calibration,
  // freshness and semantic reranking. Keep it the dominant allocation signal,
  // while allowing composition to correct concentrated slates.
  return 1 / (1 + index * 0.11);
}

function utilityFromEvidence(
  item: FrontierItem,
  index: number,
  taste: number,
  tastePolicy: FrontierSlateTastePolicy,
): number {
  const tasteEnabled = tastePolicy === 'production';
  const genericLeisurePenalty = tasteEnabled
    && ['life', 'internet_culture', 'wildcards'].includes(item.lane)
    && taste <= EXPLICIT_TASTE_THRESHOLD
    ? 0.12
    : 0;
  const genericAiPenalty = tasteEnabled
    && item.lane === 'ai_frontier'
    && taste <= EXPLICIT_TASTE_THRESHOLD
    && item.importance < 0.82
    ? 0.08
    : 0;
  const tasteUtility = tasteEnabled ? clamp(taste, 0, 0.3) * 0.42 : 0;

  return (
    rankSignal(index) * 0.62
    + item.quality * 0.11
    + item.importance * 0.11
    + tasteUtility
    + item.novelty * 0.035
    - genericLeisurePenalty
    - genericAiPenalty
  );
}

function prepareCandidates(
  ranked: FrontierItem[],
  tastePolicy: FrontierSlateTastePolicy,
): CandidateMeta[] {
  // Personal-taste classification performs semantic pattern matching. Compute it
  // exactly once per candidate in production; the disabled diagnostic path does
  // not need to evaluate fixed taste at all.
  return ranked.map((item, index) => {
    const taste = tastePolicy === 'production' ? personalTasteRankingPrior(item) : 0;
    return {
      item,
      index,
      family: frontierEditorialFamily(item),
      realm: FRONTIER_LANE_MAP[item.lane].realm,
      sourceBucket: frontierSourceBucket(item),
      taste,
      allocationUtility: utilityFromEvidence(item, index, taste, tastePolicy),
      isUtility: isFrontierUtilityItem(item),
    };
  });
}

function familyDemand(candidates: CandidateMeta[], family: FrontierEditorialFamily): number {
  const distinctSources = new Set<string>();
  const samples: number[] = [];

  for (const candidate of candidates) {
    if (samples.length >= 3) break;
    if (candidate.isUtility || candidate.family !== family || distinctSources.has(candidate.sourceBucket)) continue;
    distinctSources.add(candidate.sourceBucket);
    samples.push(candidate.allocationUtility);
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
    editorialSelectedCount: 0,
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

  // Source concentration describes the actual visible surface, so utility still
  // counts here. Editorial family/lane/realm accounting intentionally does not.
  state.sourceCounts.set(candidate.sourceBucket, count(state.sourceCounts, candidate.sourceBucket) + 1);
  if (candidate.isUtility) return;

  state.editorialSelectedCount += 1;
  state.familyCounts.set(candidate.family, count(state.familyCounts, candidate.family) + 1);
  state.laneCounts.set(candidate.item.lane, count(state.laneCounts, candidate.item.lane) + 1);
  state.realmCounts.set(candidate.realm, count(state.realmCounts, candidate.realm) + 1);
}

function bestEligible(
  candidates: CandidateMeta[],
  state: SelectionState,
  limit: number,
  targetShare: Record<FrontierEditorialFamily, number>,
  tastePolicy: FrontierSlateTastePolicy,
  realm?: FrontierRealm,
): CandidateMeta | undefined {
  const laneCap = Math.max(2, Math.ceil(limit * MAX_LANE_SHARE));
  const familyCap = Math.max(2, Math.ceil(limit * MAX_FAMILY_SHARE));
  let winner: { candidate: CandidateMeta; score: number } | undefined;

  for (const candidate of candidates) {
    const { item, family, sourceBucket, taste } = candidate;
    if (candidate.isUtility || state.used.has(item.id)) continue;
    if (realm && candidate.realm !== realm) continue;

    const familyCount = count(state.familyCounts, family);
    if (familyCount >= familyCap) continue;

    const sameLane = count(state.laneCounts, item.lane);
    if (sameLane >= laneCap) continue;

    const sameSource = count(state.sourceCounts, sourceBucket);
    if (sameSource >= MAX_SOURCE_BUCKET_ITEMS) continue;

    // Generic AI gets one easy slot, then must compete as genuinely personalized
    // material. Strong/important AI is not subject to this special brake. The
    // diagnostic disabled path removes this taste-keyed gate together with the
    // taste utility and generic-content penalties.
    if (
      tastePolicy === 'production'
      && item.lane === 'ai_frontier'
      && taste <= EXPLICIT_TASTE_THRESHOLD
      && item.importance < 0.82
      && sameLane >= 1
    ) continue;

    const currentShare = state.editorialSelectedCount ? familyCount / state.editorialSelectedCount : 0;
    const deficit = Math.max(0, targetShare[family] - currentShare);
    const unseenFamily = familyCount === 0 ? 0.105 : 0;
    const score = candidate.allocationUtility
      + deficit * 0.72
      + unseenFamily
      - sameLane * 0.065
      - sameSource * 0.09;

    if (!winner || score > winner.score) winner = { candidate, score };
  }

  return winner?.candidate;
}

export function selectAdaptiveDailyAllocation(
  ranked: FrontierItem[],
  limit: number,
  options: FrontierAdaptiveSlateOptions = {},
): FrontierItem[] {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (!boundedLimit || !ranked.length) return [];
  const tastePolicy = options.tastePolicy ?? 'production';

  const allCandidates = prepareCandidates(ranked, tastePolicy);
  const rerankWindow = allCandidates.slice(0, frontierRerankWindowSize(boundedLimit, allCandidates.length));
  const state = createSelectionState();
  const targets = familyTargetsFromDemand(familyDemands(rerankWindow));

  // One truly consequential signal is an editorial interrupt, not a taste quota.
  // It may cross the personalization bubble even when the ranker placed it below
  // the local rerank window, but only one gets this authority.
  addCandidate(state, allCandidates.find(({ item }) => item.lane === 'must_know' || item.importance >= 0.82));

  // Live sports state is bounded utility, not editorial taste. It remains visible
  // without consuming sports-family, lane, or After Hours editorial accounting.
  if (state.selected.length < boundedLimit && boundedLimit >= 5) {
    addCandidate(state, allCandidates.find(({ isUtility }) => isUtility));
  }

  // Broad realm coverage is a product invariant. Utility does not satisfy this
  // requirement by itself. Micro-topics are not quotas: once both editorial
  // realms have a chance, learned demand owns the rest of the local frontier.
  if (boundedLimit >= 4) {
    for (const realm of ['learn', 'play'] as const) {
      if (state.selected.length >= boundedLimit || count(state.realmCounts, realm) > 0) continue;
      addCandidate(state, bestEligible(rerankWindow, state, boundedLimit, targets, tastePolicy, realm));
    }
  }

  while (state.selected.length < boundedLimit) {
    const next = bestEligible(rerankWindow, state, boundedLimit, targets, tastePolicy);
    if (!next) break;
    addCandidate(state, next);
  }

  // Returning fewer cards is preferable to violating learned rank authority or
  // concentration caps simply to hit an arbitrary display count.
  return state.selected.map(({ item }) => item);
}

export function slateCompositionDiagnostics(
  ranked: FrontierItem[],
  selected: FrontierItem[],
  limit = selected.length,
  options: FrontierAdaptiveSlateOptions = {},
): FrontierSlateFamilyDiagnostic[] {
  const tastePolicy = options.tastePolicy ?? 'production';
  const candidates = prepareCandidates(ranked, tastePolicy);
  const rerankWindow = candidates.slice(0, frontierRerankWindowSize(Math.max(limit, selected.length), candidates.length));
  const demand = familyDemands(rerankWindow);
  const targets = familyTargetsFromDemand(demand);
  const selectedCounts = new Map<FrontierEditorialFamily, number>();
  let editorialSelectedCount = 0;
  for (const item of selected) {
    if (isFrontierUtilityItem(item)) continue;
    const family = frontierEditorialFamily(item);
    selectedCounts.set(family, count(selectedCounts, family) + 1);
    editorialSelectedCount += 1;
  }

  return FAMILIES.map((family) => {
    const selectedCount = count(selectedCounts, family);
    return {
      family,
      demand: demand[family],
      targetShare: targets[family],
      selected: selectedCount,
      realizedShare: editorialSelectedCount ? selectedCount / editorialSelectedCount : 0,
    };
  });
}
