import { FRONTIER_LANE_MAP } from './config';
import type {
  FrontierBehaviorAggregate,
  FrontierBehaviorEvent,
  FrontierBehaviorModel,
  FrontierBehaviorSnapshot,
  FrontierItem,
  FrontierLaneId,
  FrontierLayoutMode,
  FrontierTimeBucket,
  FrontierView,
} from './types';

const MAX_TOPICS = 96;
const SESSION_GAP_MS = 30 * 60_000;
const DAY_MS = 86_400_000;

export function emptyAggregate(): FrontierBehaviorAggregate {
  return { shown: 0, dwelled: 0, expanded: 0, opened: 0, saved: 0, positive: 0, negative: 0, dwellMs: 0 };
}

export function createInitialBehaviorModel(): FrontierBehaviorModel {
  return {
    implicitLearning: true,
    sessions: 0,
    totalActiveMs: 0,
    laneStats: {},
    sourceStats: {},
    topicStats: {},
    formatStats: {},
    timeStats: {},
    contextStats: {},
    layoutUses: { desk: 0, feed: 0 },
    viewUses: { today: 0, explore: 0, saved: 0, history: 0, map: 0 },
  };
}

export function timeBucket(date = new Date()): FrontierTimeBucket {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late';
}

export function formatForItem(item: FrontierItem): string {
  if (item.media?.type === 'youtube' || item.media?.type === 'video') return 'video';
  if (item.sourceKind === 'openalex') return 'paper';
  if (item.sourceKind === 'github') return 'code';
  if (['reddit', 'social', 'hackernews'].includes(item.sourceKind)) return 'thread';
  if (item.media?.type === 'image') return 'image';
  return 'text';
}

function noveltyBucket(item: FrontierItem): string {
  if (item.novelty >= 0.72) return 'high';
  if (item.novelty <= 0.38) return 'familiar';
  return 'balanced';
}

function depthBucket(item: FrontierItem): string | undefined {
  if (!item.readMinutes) return undefined;
  if (item.readMinutes <= 3) return 'quick';
  if (item.readMinutes >= 8) return 'deep';
  return 'medium';
}

function captureRankingSnapshot(model: FrontierBehaviorModel, date = new Date()): FrontierBehaviorSnapshot {
  return {
    laneStats: model.laneStats,
    sourceStats: model.sourceStats,
    topicStats: model.topicStats,
    formatStats: model.formatStats,
    contextStats: model.contextStats,
    capturedAt: date.toISOString(),
  };
}

function touchAggregate(aggregate: FrontierBehaviorAggregate | undefined, event: FrontierBehaviorEvent, now: string): FrontierBehaviorAggregate {
  const next = { ...(aggregate ?? emptyAggregate()), lastAt: now };
  switch (event.kind) {
    case 'impression': next.shown += 1; break;
    case 'dwell':
      next.dwelled += 1;
      next.dwellMs += Math.max(0, Math.min(event.dwellMs ?? 0, 120_000));
      break;
    case 'expand': next.expanded += 1; break;
    case 'open': next.opened += 1; break;
    case 'save': next.saved += 1; break;
    case 'positive': next.positive += 1; break;
    case 'negative': next.negative += 1; break;
  }
  return next;
}

function trimStats(stats: Record<string, FrontierBehaviorAggregate>, limit = MAX_TOPICS): Record<string, FrontierBehaviorAggregate> {
  const entries = Object.entries(stats);
  if (entries.length <= limit) return stats;
  return Object.fromEntries(entries
    .sort((a, b) => {
      const left = (a[1].positive * 8) + (a[1].saved * 7) + (a[1].opened * 5) + Math.min(8, a[1].dwellMs / 12_000);
      const right = (b[1].positive * 8) + (b[1].saved * 7) + (b[1].opened * 5) + Math.min(8, b[1].dwellMs / 12_000);
      return right - left;
    })
    .slice(0, limit));
}

function updateMap(
  map: Record<string, FrontierBehaviorAggregate>,
  keys: Array<string | undefined>,
  event: FrontierBehaviorEvent,
  now: string
): Record<string, FrontierBehaviorAggregate> {
  const next = { ...map };
  for (const key of keys) if (key) next[key] = touchAggregate(next[key], event, now);
  return next;
}

export function applyBehaviorEvent(
  model: FrontierBehaviorModel,
  item: FrontierItem,
  event: FrontierBehaviorEvent,
  date = new Date()
): FrontierBehaviorModel {
  if (!model.implicitLearning || item.sourceKind === 'local') return model;
  const now = date.toISOString();
  const bucket = timeBucket(date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const format = formatForItem(item);
  const novelty = noveltyBucket(item);
  const depth = depthBucket(item);
  const topicKeys = item.tags.slice(0, 8).map((tag) => tag.toLowerCase());

  return {
    ...model,
    laneStats: updateMap(model.laneStats, [item.lane], event, now),
    sourceStats: updateMap(model.sourceStats, [item.sourceKind, item.sourceLabel.toLowerCase()], event, now),
    topicStats: trimStats(updateMap(model.topicStats, topicKeys, event, now)),
    formatStats: updateMap(model.formatStats, [format], event, now),
    timeStats: updateMap(model.timeStats, [bucket], event, now),
    contextStats: trimStats(updateMap(model.contextStats, [
      `${bucket}:${item.lane}`,
      `${weekday}:${item.lane}`,
      `${bucket}:${format}`,
      `novelty:${novelty}`,
      depth ? `depth:${depth}` : undefined,
    ], event, now), 128),
    lastActiveAt: now,
  };
}

export function startBehaviorSession(model: FrontierBehaviorModel, date = new Date()): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  const now = date.toISOString();
  const last = model.lastActiveAt ? new Date(model.lastActiveAt).getTime() : 0;
  const startsNew = !model.sessionStartedAt && (model.sessions === 0 || !last || date.getTime() - last > SESSION_GAP_MS);
  return {
    ...model,
    sessions: model.sessions + (startsNew ? 1 : 0),
    sessionStartedAt: startsNew ? now : (model.sessionStartedAt ?? now),
    lastActiveAt: now,
    rankingSnapshot: startsNew ? captureRankingSnapshot(model, date) : model.rankingSnapshot,
  };
}

export function endBehaviorSession(model: FrontierBehaviorModel, date = new Date()): FrontierBehaviorModel {
  if (!model.implicitLearning || !model.sessionStartedAt) return model;
  const started = new Date(model.sessionStartedAt).getTime();
  const elapsed = Math.max(0, Math.min(date.getTime() - started, 4 * 60 * 60_000));
  return { ...model, totalActiveMs: model.totalActiveMs + elapsed, sessionStartedAt: undefined, lastActiveAt: date.toISOString() };
}

export function recordLayoutUse(model: FrontierBehaviorModel, layout: FrontierLayoutMode): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  return { ...model, layoutUses: { ...model.layoutUses, [layout]: model.layoutUses[layout] + 1 }, lastActiveAt: new Date().toISOString() };
}

export function recordViewUse(model: FrontierBehaviorModel, view: FrontierView): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  return { ...model, viewUses: { ...model.viewUses, [view]: model.viewUses[view] + 1 }, lastActiveAt: new Date().toISOString() };
}

export function aggregatePreference(
  aggregate?: FrontierBehaviorAggregate,
  date = new Date()
): { score: number; confidence: number } {
  if (!aggregate) return { score: 0, confidence: 0 };
  const shown = Math.max(1, aggregate.shown);
  // Twelve seconds of genuine viewport attention is roughly one soft engagement
  // unit. Dwell is capped by impressions so a forgotten background tab cannot
  // overwhelm explicit votes, saves, or opens.
  const dwellUnits = Math.min(shown * 1.25, aggregate.dwellMs / 12_000);
  const directEvidence = dwellUnits * 0.65 + aggregate.expanded + aggregate.opened * 2 + aggregate.saved * 3 + aggregate.positive * 3 + aggregate.negative * 3;
  if (aggregate.shown < 2 && directEvidence < 2.5) return { score: 0, confidence: 0 };

  const engaged = dwellUnits * 0.42 + aggregate.expanded * 0.48 + aggregate.opened * 0.82 + aggregate.saved * 1.05 + aggregate.positive * 1.15;
  const negative = aggregate.negative * 1.25;
  const positiveRate = (engaged - negative) / shown;
  const resolvedEngagements = Math.min(shown, dwellUnits + aggregate.expanded + aggregate.opened + aggregate.saved + aggregate.positive);
  const quietSkipRate = Math.max(0, (shown - resolvedEngagements) / shown - 0.8);
  const skipPenalty = shown >= 12 ? quietSkipRate * 0.28 : 0;
  const score = Math.max(-1, Math.min(1.2, positiveRate - skipPenalty));
  const evidence = aggregate.shown + Math.min(6, dwellUnits) + aggregate.opened * 2 + aggregate.saved * 3 + aggregate.positive * 3 + aggregate.negative * 3;
  const ageDays = aggregate.lastAt ? Math.max(0, (date.getTime() - new Date(aggregate.lastAt).getTime()) / DAY_MS) : 0;
  const recency = Math.max(0.35, Math.exp(-ageDays / 120));
  return { score, confidence: Math.min(1, evidence / 20) * recency };
}

export function behavioralAdjustment(item: FrontierItem, model?: FrontierBehaviorModel, date = new Date()): number {
  if (!model?.implicitLearning || item.sourceKind === 'local' || !model.rankingSnapshot) return 0;
  const memory = model.rankingSnapshot;
  const bucket = timeBucket(date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const format = formatForItem(item);
  const novelty = noveltyBucket(item);
  const depth = depthBucket(item);
  const signals: Array<[FrontierBehaviorAggregate | undefined, number]> = [
    [memory.laneStats[item.lane], 0.055],
    [memory.sourceStats[item.sourceKind], 0.018],
    [memory.sourceStats[item.sourceLabel.toLowerCase()], 0.016],
    [memory.formatStats[format], 0.025],
    [memory.contextStats[`${bucket}:${item.lane}`], 0.04],
    [memory.contextStats[`${weekday}:${item.lane}`], 0.022],
    [memory.contextStats[`${bucket}:${format}`], 0.018],
    [memory.contextStats[`novelty:${novelty}`], 0.018],
    [depth ? memory.contextStats[`depth:${depth}`] : undefined, 0.012],
  ];
  for (const tag of item.tags.slice(0, 5)) signals.push([memory.topicStats[tag.toLowerCase()], 0.018]);

  return signals.reduce((sum, [aggregate, weight]) => {
    const preference = aggregatePreference(aggregate, date);
    return sum + preference.score * preference.confidence * weight;
  }, 0);
}

export function behavioralExplorationBonus(item: FrontierItem, model?: FrontierBehaviorModel, date = new Date()): number {
  if (!model?.implicitLearning || !model.rankingSnapshot || item.sourceKind === 'local') return 0;
  const memory = model.rankingSnapshot;
  const evidence = [memory.laneStats[item.lane], ...item.tags.slice(0, 4).map((tag) => memory.topicStats[tag.toLowerCase()])]
    .map((aggregate) => aggregatePreference(aggregate, date).confidence);
  const meanConfidence = evidence.length ? evidence.reduce((sum, value) => sum + value, 0) / evidence.length : 0;
  // A tiny UCB-like uncertainty bonus prevents early feedback from collapsing the
  // world model. It is deliberately much smaller than explicit preference terms.
  return Math.max(0, Math.min(0.035, (1 - meanConfidence) * item.novelty * 0.035));
}

export type FrontierHabitInsight = { label: string; detail: string; confidence: number };

function strongestEntry(stats: Record<string, FrontierBehaviorAggregate>, date = new Date()): [string, FrontierBehaviorAggregate] | undefined {
  const best = Object.entries(stats)
    .map(([key, value]) => ({ key, value, pref: aggregatePreference(value, date) }))
    .filter((entry) => entry.pref.confidence >= 0.18 && entry.pref.score > 0.12)
    .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))[0];
  return best ? [best.key, best.value] : undefined;
}

function laneName(id: string): string {
  return FRONTIER_LANE_MAP[id as FrontierLaneId]?.shortLabel ?? id;
}

export function summarizeHabits(model: FrontierBehaviorModel, date = new Date()): FrontierHabitInsight[] {
  const insights: FrontierHabitInsight[] = [];
  const lane = strongestEntry(model.laneStats, date);
  if (lane) {
    const pref = aggregatePreference(lane[1], date);
    insights.push({ label: 'Pulls you in', detail: `${laneName(lane[0])} is earning unusually strong engagement.`, confidence: pref.confidence });
  }

  const contextual = Object.entries(model.contextStats)
    .filter(([key]) => /^(morning|afternoon|evening|late):/.test(key))
    .map(([key, value]) => ({ key, value, pref: aggregatePreference(value, date) }))
    .filter((entry) => entry.pref.confidence >= 0.28 && entry.pref.score > 0.18)
    .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))[0];
  if (contextual) {
    const [bucket, subject] = contextual.key.split(':');
    insights.push({
      label: 'Habit pocket',
      detail: `${bucket} + ${FRONTIER_LANE_MAP[subject as FrontierLaneId]?.shortLabel ?? subject} is becoming a recurring high-attention combination.`,
      confidence: contextual.pref.confidence,
    });
  }

  const format = strongestEntry(model.formatStats, date);
  if (format) {
    const pref = aggregatePreference(format[1], date);
    insights.push({ label: 'Format', detail: `${format[0]} signals are getting more of your attention.`, confidence: pref.confidence });
  }
  const time = strongestEntry(model.timeStats, date);
  if (time) {
    const pref = aggregatePreference(time[1], date);
    insights.push({ label: 'Rhythm', detail: `${time[0]} is becoming a high-engagement FRONTIER window.`, confidence: pref.confidence });
  }

  const highNovelty = aggregatePreference(model.contextStats['novelty:high'], date);
  const familiar = aggregatePreference(model.contextStats['novelty:familiar'], date);
  if (highNovelty.confidence >= 0.3 && highNovelty.score > familiar.score + 0.18) {
    insights.push({ label: 'Discovery appetite', detail: 'You are consistently rewarding higher-novelty discoveries.', confidence: highNovelty.confidence });
  } else if (familiar.confidence >= 0.3 && familiar.score > highNovelty.score + 0.18) {
    insights.push({ label: 'Discovery appetite', detail: 'You are currently spending more time on familiar, high-relevance signal.', confidence: familiar.confidence });
  }

  const preferredLayout = model.layoutUses.feed === model.layoutUses.desk ? undefined : model.layoutUses.feed > model.layoutUses.desk ? 'Feed' : 'Desk';
  const layoutTotal = model.layoutUses.feed + model.layoutUses.desk;
  if (preferredLayout && layoutTotal >= 3) insights.push({ label: 'Reading mode', detail: `You use ${preferredLayout} more often.`, confidence: Math.min(1, layoutTotal / 12) });

  const primaryViews = Object.entries(model.viewUses).sort((a, b) => b[1] - a[1]);
  const totalViews = primaryViews.reduce((sum, [, count]) => sum + count, 0);
  if (primaryViews[0] && primaryViews[0][1] >= 3 && totalViews >= 5) {
    const viewLabels: Record<FrontierView, string> = { today: 'Today', explore: 'Explore', saved: 'Saved', history: 'History', map: 'Radar' };
    insights.push({
      label: 'Navigation habit',
      detail: `${viewLabels[primaryViews[0][0] as FrontierView]} is your most-used FRONTIER view so far.`,
      confidence: Math.min(1, primaryViews[0][1] / 10),
    });
  }

  if (model.sessions >= 2 && model.totalActiveMs > 0) {
    const avgMinutes = Math.max(1, Math.round(model.totalActiveMs / model.sessions / 60_000));
    insights.push({ label: 'Session shape', detail: `A typical visit is about ${avgMinutes} minute${avgMinutes === 1 ? '' : 's'}.`, confidence: Math.min(1, model.sessions / 10) });
  }
  return insights.slice(0, 6);
}
