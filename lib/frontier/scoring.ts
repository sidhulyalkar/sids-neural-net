import { selectAdaptiveDailyAllocation } from './adaptiveSlate';
import { behavioralAdjustment, behavioralExplorationBonus, formatForItem, aggregatePreference, timeBucket } from './behavior';
import { buildConnectionExposureIndex, connectionPortfolioAdjustment } from './connectionPortfolio';
import { FRONTIER_LANE_MAP } from './config';
import {
  buildDirectPreferenceEvidenceIndex,
  directPreferenceSignalsForItem,
  effectiveDirectPreferenceAffinity,
  type FrontierDirectPreferenceEvidenceIndex,
} from './directPreferenceEvidence';
import { personalInterestConnection } from './interestGraph';
import {
  buildPairEvidenceIndex,
  effectivePairAffinityForItem,
  pairEvidenceForItem,
  type FrontierPairEvidenceIndex,
} from './pairEvidence';
import {
  personalTasteRankingPrior,
  strongestPersonalTasteLabel,
} from './personalTaste';
import {
  buildSessionIntent,
  sessionIntentAdjustment,
  type FrontierSessionIntent,
} from './sessionIntent';
import { isFrontierSourceAdmitted, sourceTrustRankingPrior } from './sourceTrust';
import { applyExplicitPairSignal, pairAffinityForItem } from './tasteLearning';
import type {
  FrontierBehaviorModel,
  FrontierHistoryEntry,
  FrontierItem,
  FrontierProfile,
  FrontierQuest,
  FrontierReaction,
} from './types';

const DAY_MS = 86_400_000;
const RESURFACE_DAYS = [1, 3, 7];
const CANONICAL_DAILY_RUN_SIZE = 14;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function freshnessScore(publishedAt: string, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / DAY_MS);
  return Math.exp(-ageDays / 5);
}

function reactionValue(reaction: FrontierReaction): number {
  switch (reaction) {
    case 'up': return 0.82;
    case 'down': return -0.72;
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

function consequentialInterruptPrior(item: FrontierItem): number {
  if (item.lane !== 'must_know') return 0;
  const severity = clamp((item.importance - 0.82) / 0.16);
  const evidenceQuality = clamp((item.quality - 0.72) / 0.26);
  return Math.min(0.1, severity * evidenceQuality * 0.1);
}

export function applyReactionToProfile(profile: FrontierProfile, item: FrontierItem, reaction: FrontierReaction): FrontierProfile {
  const value = reactionValue(reaction);
  const next: FrontierProfile = {
    laneAffinity: { ...profile.laneAffinity },
    topicAffinity: { ...profile.topicAffinity },
    sourceAffinity: { ...profile.sourceAffinity },
    interestPairs: { ...profile.interestPairs },
    knownTopics: { ...profile.knownTopics },
    curiosity: profile.curiosity,
    meaningfulInteractions: profile.meaningfulInteractions + (reaction === 'read' ? 0 : 1),
  };

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
  if (reaction === 'hide' || reaction === 'down') next.curiosity = clamp(next.curiosity - 0.01, 0.08, 0.55);
  return applyExplicitPairSignal(next, item, value);
}

export function resurfaceBonus(entry: FrontierHistoryEntry | undefined, now = new Date()): number {
  if (!entry || ['hide', 'meh', 'down', 'known'].includes(entry.reaction ?? '')) return 0;
  if (entry.reaction && ['read', 'love', 'up', 'useful', 'important'].includes(entry.reaction)) return 0;
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

function learnedPairAffinity(
  item: FrontierItem,
  profile: FrontierProfile,
  pairEvidence?: FrontierPairEvidenceIndex,
): number {
  const legacy = pairAffinityForItem(item, profile);
  return effectivePairAffinityForItem(item, legacy, pairEvidence);
}

export function personalizedScore(
  item: FrontierItem,
  profile: FrontierProfile,
  historyEntry?: FrontierHistoryEntry,
  now = new Date(),
  behavior?: FrontierBehaviorModel,
  pairEvidence?: FrontierPairEvidenceIndex,
  sessionIntent?: FrontierSessionIntent,
  directPreferenceEvidence?: FrontierDirectPreferenceEvidenceIndex,
): number {
  if (historyEntry?.reaction === 'hide') return -1;

  const { laneAffinity, sourceAffinity, topicSignal } = directPreferenceSignalsForItem(
    item,
    profile,
    directPreferenceEvidence,
  );
  const pairSignal = learnedPairAffinity(item, profile, pairEvidence);
  const knownness = item.tags.length
    ? item.tags.reduce((sum, tag) => sum + (profile.knownTopics[tag.toLowerCase()] ?? 0), 0) / item.tags.length
    : 0;

  const freshness = freshnessScore(item.publishedAt, now);
  const surpriseTarget = 0.52;
  const usefulSurprise = 1 - Math.min(1, Math.abs(item.novelty - surpriseTarget) / surpriseTarget);
  const learnedBehavior = behavioralAdjustment(item, behavior, now);
  const exploration = behavioralExplorationBonus(item, behavior, now) * (0.65 + profile.curiosity);
  const sourceTrustPrior = sourceTrustRankingPrior(item);
  const explicitTaste = personalTasteRankingPrior(item);
  const tasteSuppression = laneAffinity <= -0.15 || topicSignal <= -0.12 ? 0.25 : 1;
  const tastePrior = explicitTaste * tasteSuppression;
  const connection = personalInterestConnection(item);
  const learnedConnectionGate = pairSignal <= -0.15 ? 0.12 : 1;
  const connectionPrior = connection.score * connection.confidence * tasteSuppression * learnedConnectionGate;
  const activeIntent = sessionIntent ? sessionIntentAdjustment(item, sessionIntent).score : 0;
  const consequentialInterrupt = consequentialInterruptPrior(item);

  const score =
    item.baseScore * 0.28 +
    item.importance * 0.2 +
    item.quality * 0.12 +
    item.momentum * 0.08 +
    freshness * 0.08 +
    laneAffinity * 0.09 +
    topicSignal * 0.08 +
    pairSignal * 0.045 +
    sourceAffinity * 0.03 +
    usefulSurprise * profile.curiosity * 0.12 -
    knownness * 0.08 +
    learnedBehavior +
    exploration +
    sourceTrustPrior +
    tastePrior +
    connectionPrior +
    activeIntent +
    consequentialInterrupt +
    resurfaceBonus(historyEntry, now);

  return clamp(score, -1, 1.5);
}

export function rankFrontierItems(
  items: FrontierItem[],
  profile: FrontierProfile,
  history: Record<string, FrontierHistoryEntry>,
  now = new Date(),
  behavior?: FrontierBehaviorModel,
  pairEvidence = buildPairEvidenceIndex(history, now),
  sessionIntent = buildSessionIntent(history, now),
  directPreferenceEvidence = buildDirectPreferenceEvidenceIndex(history, now),
): FrontierItem[] {
  const connectionExposure = buildConnectionExposureIndex(history, now);
  return items
    .filter((item) => history[item.id]?.reaction !== 'hide' && isFrontierSourceAdmitted(item))
    .map((item) => {
      const pairSignal = learnedPairAffinity(item, profile, pairEvidence);
      const preferenceEvidence = pairEvidenceForItem(item, pairEvidence);
      const portfolio = connectionPortfolioAdjustment(
        item,
        connectionExposure,
        pairSignal,
        preferenceEvidence.confidence,
      );
      return {
        item,
        score: personalizedScore(
          item,
          profile,
          history[item.id],
          now,
          behavior,
          pairEvidence,
          sessionIntent,
          directPreferenceEvidence,
        ) + portfolio.net,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function selectDailyAllocation(
  ranked: FrontierItem[],
  history: Record<string, FrontierHistoryEntry>,
  limit: number,
  now: Date
): FrontierItem[] {
  void history;
  void now;
  return selectAdaptiveDailyAllocation(ranked, limit);
}

export function selectDailyRun(
  ranked: FrontierItem[],
  history: Record<string, FrontierHistoryEntry>,
  limit = CANONICAL_DAILY_RUN_SIZE,
  now = new Date()
): FrontierItem[] {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (boundedLimit <= CANONICAL_DAILY_RUN_SIZE) {
    return selectDailyAllocation(ranked, history, boundedLimit, now);
  }

  const canonical = selectDailyAllocation(ranked, history, CANONICAL_DAILY_RUN_SIZE, now);
  const expanded = selectDailyAllocation(ranked, history, boundedLimit, now);
  const canonicalIds = new Set(canonical.map((item) => item.id));
  return [
    ...canonical,
    ...expanded.filter((item) => !canonicalIds.has(item.id)),
  ].slice(0, boundedLimit);
}

export function explainRecommendation(
  item: FrontierItem,
  profile: FrontierProfile,
  behavior?: FrontierBehaviorModel,
  now = new Date(),
  pairEvidence?: FrontierPairEvidenceIndex,
  directPreferenceEvidence?: FrontierDirectPreferenceEvidenceIndex,
): string {
  const directSignals = directPreferenceSignalsForItem(item, profile, directPreferenceEvidence);
  const strongestTag = item.tags
    .map((tag) => ({
      tag,
      affinity: effectiveDirectPreferenceAffinity(
        profile.topicAffinity[tag.toLowerCase()] ?? 0,
        'topic',
        tag,
        directPreferenceEvidence,
      ),
    }))
    .sort((a, b) => b.affinity - a.affinity)[0];
  const tasteSuppressed = directSignals.laneAffinity <= -0.15 || directSignals.topicSignal <= -0.12;

  if (item.sportsState) return `Live ${item.sportsState.leagueLabel} state stays in your finite run without displacing the deeper sports analysis.`;

  if (behavior?.implicitLearning) {
    const bucket = timeBucket(now);
    const context = aggregatePreference(behavior.contextStats[`${bucket}:${item.lane}`]);
    if (context.confidence >= 0.35 && context.score > 0.2) {
      return `You tend to engage with ${FRONTIER_LANE_MAP[item.lane].shortLabel} more in the ${bucket}.`;
    }
    const format = formatForItem(item);
    const formatPreference = aggregatePreference(behavior.formatStats[format]);
    if (formatPreference.confidence >= 0.45 && formatPreference.score > 0.24) {
      return `Your recent behavior suggests a growing preference for ${format} signals.`;
    }
  }

  const connection = personalInterestConnection(item);
  const pairSignal = learnedPairAffinity(item, profile, pairEvidence);
  if (connection.explanation && connection.confidence >= 0.62 && pairSignal > -0.15 && !tasteSuppressed) return connection.explanation;
  if (resurfaceLike(item)) return 'Second chance: this signal was worth keeping in orbit.';
  if (item.importance >= 0.8) return 'High global importance, promoted even beyond your normal taste profile.';
  const personalLabel = strongestPersonalTasteLabel(item);
  if (personalLabel && personalTasteRankingPrior(item) >= 0.09 && !tasteSuppressed) return `Strong fit with your ${personalLabel} radar.`;
  if (strongestTag && strongestTag.affinity > 0.08) return `Your interest in ${strongestTag.tag} pulled this into range.`;
  if (directSignals.laneAffinity > 0.12) return `Your ${FRONTIER_LANE_MAP[item.lane].shortLabel} signal has been strengthening.`;
  if (item.novelty > 0.72) return 'Exploration slot: adjacent enough to matter, different enough to expand the map.';
  return item.why || `Strong fit for your ${FRONTIER_LANE_MAP[item.lane].shortLabel} radar.`;
}

function resurfaceLike(item: FrontierItem): boolean {
  return item.tags.some((tag) => tag === 'second-chance');
}

export function buildDailyQuests(history: Record<string, FrontierHistoryEntry>, dayKey: string): FrontierQuest[] {
  const todays = Object.values(history).filter((entry) => entry.reactedAt?.startsWith(dayKey));
  const meaningful = todays.filter((entry) => entry.reaction && !['meh', 'down', 'hide', 'known'].includes(entry.reaction));
  const hasBrainfood = meaningful.some((entry) => FRONTIER_LANE_MAP[entry.item.lane].realm === 'learn');
  const hasAfterHours = meaningful.some((entry) => FRONTIER_LANE_MAP[entry.item.lane].realm === 'play');
  const surprises = todays.filter((entry) => entry.reaction === 'surprise').length;
  const secondChances = todays.filter((entry) => entry.item.tags.includes('second-chance')).length;

  return [
    { id: 'brainfood', label: 'Brainfood', description: 'Resolve one paper, codebase, method, or science signal.', current: Number(hasBrainfood), target: 1, complete: hasBrainfood, xp: 14 },
    { id: 'clubhouse', label: 'Clubhouse', description: 'Catch one team, active sport, game, Screen Orbit, music, or culture signal.', current: Number(hasAfterHours), target: 1, complete: hasAfterHours, xp: 12 },
    { id: 'second-wind', label: 'Second Wind', description: 'Resolve something the radar brought back for another look.', current: Math.min(1, secondChances), target: 1, complete: secondChances >= 1, xp: 12 },
    { id: 'curiosity', label: 'Useful Surprise', description: 'Mark one discovery as genuinely surprising.', current: Math.min(1, surprises), target: 1, complete: surprises >= 1, xp: 12 },
  ];
}
