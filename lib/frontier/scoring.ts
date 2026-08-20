import { FRONTIER_LANE_MAP } from './config';
import type {
  FrontierHistoryEntry,
  FrontierItem,
  FrontierProfile,
  FrontierQuest,
  FrontierReaction,
} from './types';

const DAY_MS = 86_400_000;
const RESURFACE_DAYS = [1, 3, 7];

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function freshnessScore(publishedAt: string, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / DAY_MS);
  return Math.exp(-ageDays / 5);
}

function reactionValue(reaction: FrontierReaction): number {
  switch (reaction) {
    case 'love': return 1;
    case 'important': return 0.88;
    case 'surprise': return 0.76;
    case 'useful': return 0.62;
    case 'later': return 0.35;
    case 'read': return 0.22;
    case 'known': return 0;
    case 'meh': return -0.45;
    case 'hide': return -1;
  }
}

export function applyReactionToProfile(
  profile: FrontierProfile,
  item: FrontierItem,
  reaction: FrontierReaction
): FrontierProfile {
  const value = reactionValue(reaction);
  const next: FrontierProfile = {
    laneAffinity: { ...profile.laneAffinity },
    topicAffinity: { ...profile.topicAffinity },
    sourceAffinity: { ...profile.sourceAffinity },
    knownTopics: { ...profile.knownTopics },
    curiosity: profile.curiosity,
    meaningfulInteractions: profile.meaningfulInteractions + (reaction === 'read' ? 0 : 1),
  };

  // "Already knew" advances the knowledge frontier without teaching dislike.
  if (reaction === 'known') {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      next.knownTopics[key] = clamp((next.knownTopics[key] ?? 0) + 0.2, 0, 1.5);
    }
    return next;
  }

  const laneDelta = value * 0.1;
  next.laneAffinity[item.lane] = clamp((next.laneAffinity[item.lane] ?? 0) + laneDelta, -0.75, 1.25);
  next.sourceAffinity[item.sourceKind] = clamp((next.sourceAffinity[item.sourceKind] ?? 0) + value * 0.045, -0.5, 0.8);

  for (const tag of item.tags.slice(0, 7)) {
    const key = tag.toLowerCase();
    next.topicAffinity[key] = clamp((next.topicAffinity[key] ?? 0) + value * 0.075, -0.8, 1.4);
  }

  if (reaction === 'surprise') next.curiosity = clamp(next.curiosity + 0.035, 0.08, 0.55);
  if (reaction === 'hide') next.curiosity = clamp(next.curiosity - 0.015, 0.08, 0.55);
  return next;
}

export function resurfaceBonus(entry: FrontierHistoryEntry | undefined, now = new Date()): number {
  if (!entry || entry.reaction === 'hide' || entry.reaction === 'meh' || entry.reaction === 'known') return 0;
  if (entry.reaction === 'read' || entry.reaction === 'love' || entry.reaction === 'useful' || entry.reaction === 'important') return 0;
  if (entry.resurfacedCount >= RESURFACE_DAYS.length) return 0;

  const sinceSeenDays = (now.getTime() - new Date(entry.lastSeenAt).getTime()) / DAY_MS;
  const dueAfter = RESURFACE_DAYS[Math.min(entry.resurfacedCount, RESURFACE_DAYS.length - 1)];
  if (sinceSeenDays < dueAfter) return 0;

  const importanceMultiplier = 0.7 + entry.item.importance * 0.6;
  return clamp(0.14 * importanceMultiplier, 0, 0.24);
}

export function isDueForResurface(entry: FrontierHistoryEntry, now = new Date()): boolean {
  return resurfaceBonus(entry, now) > 0;
}

export function personalizedScore(
  item: FrontierItem,
  profile: FrontierProfile,
  historyEntry?: FrontierHistoryEntry,
  now = new Date()
): number {
  if (historyEntry?.reaction === 'hide') return -1;

  const laneAffinity = profile.laneAffinity[item.lane] ?? 0;
  const sourceAffinity = profile.sourceAffinity[item.sourceKind] ?? 0;
  const topicSignal = item.tags.length
    ? item.tags.reduce((sum, tag) => sum + (profile.topicAffinity[tag.toLowerCase()] ?? 0), 0) / item.tags.length
    : 0;
  const knownness = item.tags.length
    ? item.tags.reduce((sum, tag) => sum + (profile.knownTopics[tag.toLowerCase()] ?? 0), 0) / item.tags.length
    : 0;

  const freshness = freshnessScore(item.publishedAt, now);
  const surpriseTarget = 0.52;
  const usefulSurprise = 1 - Math.min(1, Math.abs(item.novelty - surpriseTarget) / surpriseTarget);

  const score =
    item.baseScore * 0.28 +
    item.importance * 0.2 +
    item.quality * 0.12 +
    item.momentum * 0.08 +
    freshness * 0.08 +
    laneAffinity * 0.09 +
    topicSignal * 0.08 +
    sourceAffinity * 0.03 +
    usefulSurprise * profile.curiosity * 0.12 -
    knownness * 0.08 +
    resurfaceBonus(historyEntry, now);

  return clamp(score, -1, 1.5);
}

export function rankFrontierItems(
  items: FrontierItem[],
  profile: FrontierProfile,
  history: Record<string, FrontierHistoryEntry>,
  now = new Date()
): FrontierItem[] {
  return items
    .filter((item) => history[item.id]?.reaction !== 'hide')
    .map((item) => ({
      item,
      score: personalizedScore(item, profile, history[item.id], now),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function takeFirst(
  source: FrontierItem[],
  used: Set<string>,
  predicate: (item: FrontierItem) => boolean
): FrontierItem | undefined {
  const item = source.find((candidate) => !used.has(candidate.id) && predicate(candidate));
  if (item) used.add(item.id);
  return item;
}

/**
 * A finite daily run with an editorial spine. It guarantees breadth before
 * filling the remaining slots from the personalized ranking.
 */
export function selectDailyRun(
  ranked: FrontierItem[],
  history: Record<string, FrontierHistoryEntry>,
  limit = 14,
  now = new Date()
): FrontierItem[] {
  const used = new Set<string>();
  const selected: FrontierItem[] = [];
  const push = (item?: FrontierItem) => { if (item) selected.push(item); };

  push(takeFirst(ranked, used, (item) => item.importance >= 0.72 || item.lane === 'must_know'));
  push(takeFirst(ranked, used, (item) => item.lane === 'premier_league'));
  push(takeFirst(ranked, used, (item) => item.lane === 'ml_data'));
  push(takeFirst(ranked, used, (item) => item.lane === 'ai_frontier'));
  push(takeFirst(ranked, used, (item) => item.lane === 'neuro_frontier'));
  push(takeFirst(ranked, used, (item) => isDueForResurface(history[item.id], now)));
  push(takeFirst(ranked, used, (item) => item.lane === 'methods' || item.lane === 'builder_signal'));
  push(takeFirst(ranked, used, (item) => item.novelty >= 0.68 || item.lane === 'wildcards'));

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (used.has(item.id)) continue;

    // Prevent one lane from swallowing the finite briefing.
    const sameLane = selected.filter((candidate) => candidate.lane === item.lane).length;
    if (sameLane >= Math.max(2, Math.ceil(limit * 0.26))) continue;
    selected.push(item);
    used.add(item.id);
  }

  return selected;
}

export function explainRecommendation(item: FrontierItem, profile: FrontierProfile): string {
  const strongestTag = item.tags
    .map((tag) => ({ tag, affinity: profile.topicAffinity[tag.toLowerCase()] ?? 0 }))
    .sort((a, b) => b.affinity - a.affinity)[0];

  if (resurfaceLike(item)) return 'Second chance: this signal was worth keeping in orbit.';
  if (item.importance >= 0.8) return 'High global importance, promoted even beyond your normal taste profile.';
  if (strongestTag && strongestTag.affinity > 0.08) return `Your recent interest in ${strongestTag.tag} pulled this into range.`;
  if ((profile.laneAffinity[item.lane] ?? 0) > 0.12) return `Your ${FRONTIER_LANE_MAP[item.lane].shortLabel} signal has been strengthening.`;
  if (item.novelty > 0.72) return 'Exploration slot: adjacent enough to matter, different enough to expand the map.';
  return item.why || `Strong fit for your ${FRONTIER_LANE_MAP[item.lane].shortLabel} radar.`;
}

function resurfaceLike(item: FrontierItem): boolean {
  return item.tags.some((tag) => tag === 'second-chance');
}

export function buildDailyQuests(history: Record<string, FrontierHistoryEntry>, dayKey: string): FrontierQuest[] {
  const todays = Object.values(history).filter((entry) => entry.reactedAt?.startsWith(dayKey));
  const meaningful = todays.filter((entry) => entry.reaction && !['meh', 'hide', 'known'].includes(entry.reaction));
  const lanes = new Set(meaningful.map((entry) => entry.item.lane));
  const hasSoccer = meaningful.some((entry) => ['premier_league', 'world_soccer'].includes(entry.item.lane));
  const hasMl = meaningful.some((entry) => ['ml_data', 'ai_frontier', 'methods'].includes(entry.item.lane));
  const surprises = todays.filter((entry) => entry.reaction === 'surprise').length;
  const secondChances = todays.filter((entry) => entry.item.tags.includes('second-chance')).length;

  return [
    {
      id: 'hat-trick', label: 'Hat Trick', description: 'Meaningfully engage across three different knowledge lanes.',
      current: Math.min(3, lanes.size), target: 3, complete: lanes.size >= 3, xp: 18,
    },
    {
      id: 'pitch-python', label: 'Pitch + Python', description: 'Learn one soccer signal and one ML/data signal.',
      current: Number(hasSoccer) + Number(hasMl), target: 2, complete: hasSoccer && hasMl, xp: 16,
    },
    {
      id: 'second-wind', label: 'Second Wind', description: 'Resolve something the radar brought back for another look.',
      current: Math.min(1, secondChances), target: 1, complete: secondChances >= 1, xp: 12,
    },
    {
      id: 'curiosity', label: 'Useful Surprise', description: 'Mark one discovery as genuinely surprising.',
      current: Math.min(1, surprises), target: 1, complete: surprises >= 1, xp: 12,
    },
  ];
}
