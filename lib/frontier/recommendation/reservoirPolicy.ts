import { personalTasteRankingPrior } from '../personalTaste';
import { assessFrontierSource, isFrontierSourceAdmitted } from '../sourceTrust';
import type { FrontierItem } from '../types';

const DAY_MS = 86_400_000;
export const FRONTIER_RESERVOIR_CAPACITY = 2048;
export const FRONTIER_RESERVOIR_MIN_VALIDATION = 0.54;

export type FrontierReservoirCandidate = {
  key: string;
  item: FrontierItem;
  discoveredAt: number;
  validationScore: number;
  lastOfferedAt: number;
  offerCount: number;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function publishedAtMs(item: FrontierItem, fallback: number): number {
  const value = new Date(item.publishedAt).getTime();
  return Number.isFinite(value) ? value : fallback;
}

export function frontierReservoirShelfLifeMs(item: FrontierItem): number {
  if (item.sourceKind === 'sports_state' || item.sportsState) return 18 * 60 * 60_000;
  if (item.lane === 'world_pulse' || item.lane === 'must_know') return 3 * DAY_MS;
  if (['team_pulse', 'premier_league', 'world_soccer', 'sports'].includes(item.lane)) return 5 * DAY_MS;
  if (['internet_culture', 'music', 'screen', 'gaming', 'life'].includes(item.lane)) return 14 * DAY_MS;
  if (['builder_signal', 'methods', 'creative_tech'].includes(item.lane) || item.sourceKind === 'github') return 35 * DAY_MS;
  if (
    ['ai_frontier', 'ml_data', 'neuro_frontier', 'broad_science'].includes(item.lane)
    || ['arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface'].includes(item.sourceKind)
  ) return 45 * DAY_MS;
  return 21 * DAY_MS;
}

/**
 * Validation is deliberately intrinsic rather than personalized. The reservoir
 * answers "is this worth keeping around?" while the recommender answers "is it
 * worth showing today?". Keeping those authorities separate prevents a short
 * taste swing from deleting excellent research/code from the candidate shelf.
 */
export function frontierReservoirValidationScore(item: FrontierItem): number {
  if (!isFrontierSourceAdmitted(item) || item.sourceKind === 'local') return 0;
  const trust = assessFrontierSource(item).score;
  const durablePrimary = ['github', 'arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface']
    .includes(item.sourceKind) ? 0.045 : 0;
  return clamp(
    item.quality * 0.31
    + item.importance * 0.22
    + item.baseScore * 0.17
    + item.novelty * 0.12
    + item.momentum * 0.06
    + trust * 0.12
    + durablePrimary
  );
}

export function frontierReservoirEligible(item: FrontierItem, discoveredAt: number, now = Date.now()): boolean {
  const published = publishedAtMs(item, discoveredAt);
  if (now - published > frontierReservoirShelfLifeMs(item)) return false;
  return frontierReservoirValidationScore(item) >= FRONTIER_RESERVOIR_MIN_VALIDATION;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitNoise(value: string): number {
  return hashString(value) / 0xffffffff;
}

function localDayKey(now: number): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sourceHost(item: FrontierItem): string {
  try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return item.source; }
}

function dailyUtility(record: FrontierReservoirCandidate, now: number, dayKey: string): number {
  const published = publishedAtMs(record.item, record.discoveredAt);
  const shelf = frontierReservoirShelfLifeMs(record.item);
  const normalizedAge = clamp((now - published) / Math.max(1, shelf));
  const remainingFreshness = 1 - normalizedAge;
  const tasteCompass = Math.max(0, personalTasteRankingPrior(record.item));
  const random = unitNoise(`${dayKey}:${record.key}`);
  return (
    record.validationScore * 0.55
    + remainingFreshness * 0.16
    + tasteCompass * 0.8
    + random * 0.2
  );
}

/**
 * Produce one stable daily cross-section from the durable shelf. The same local
 * day always yields the same order, so background polling and repeated reads
 * cannot reshuffle the feed. The next day receives a new bounded random draw.
 * Lane/source caps keep a large paper reservoir from swallowing games, sports,
 * music, or visual work.
 */
export function sampleFrontierReservoirForDay(
  records: FrontierReservoirCandidate[],
  limit = 96,
  now = Date.now(),
): FrontierReservoirCandidate[] {
  const boundedLimit = Math.max(0, Math.min(FRONTIER_RESERVOIR_CAPACITY, Math.floor(limit)));
  if (!boundedLimit) return [];
  const dayKey = localDayKey(now);
  const eligible = records
    .filter((record) => frontierReservoirEligible(record.item, record.discoveredAt, now))
    .map((record) => ({ record, utility: dailyUtility(record, now, dayKey) }))
    .sort((left, right) => right.utility - left.utility || left.record.key.localeCompare(right.record.key));

  const selected: FrontierReservoirCandidate[] = [];
  const selectedKeys = new Set<string>();
  const laneCounts = new Map<string, number>();
  const hostCounts = new Map<string, number>();
  const laneCap = Math.max(3, Math.ceil(boundedLimit * 0.2));
  const hostCap = Math.max(2, Math.ceil(boundedLimit * 0.06));

  const takePass = (relaxLaneCap: boolean) => {
    for (const { record } of eligible) {
      if (selected.length >= boundedLimit) break;
      if (selectedKeys.has(record.key)) continue;
      const laneCount = laneCounts.get(record.item.lane) ?? 0;
      const host = sourceHost(record.item);
      const hostCount = hostCounts.get(host) ?? 0;
      if (!relaxLaneCap && laneCount >= laneCap) continue;
      if (hostCount >= hostCap) continue;
      selected.push(record);
      selectedKeys.add(record.key);
      laneCounts.set(record.item.lane, laneCount + 1);
      hostCounts.set(host, hostCount + 1);
    }
  };

  takePass(false);
  takePass(true);
  return selected;
}
