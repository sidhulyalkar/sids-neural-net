import { FRONTIER_LANE_MAP } from './config';
import type {
  FrontierBehaviorAggregate,
  FrontierBehaviorEvent,
  FrontierBehaviorModel,
  FrontierItem,
  FrontierLayoutMode,
  FrontierTimeBucket,
  FrontierView,
} from './types';

const MAX_TOPICS = 96;
const SESSION_GAP_MS = 30 * 60_000;

export function emptyAggregate(): FrontierBehaviorAggregate {
  return {
    shown: 0,
    dwelled: 0,
    expanded: 0,
    opened: 0,
    saved: 0,
    positive: 0,
    negative: 0,
    dwellMs: 0,
  };
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

function touchAggregate(
  aggregate: FrontierBehaviorAggregate | undefined,
  event: FrontierBehaviorEvent,
  now: string
): FrontierBehaviorAggregate {
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
      const left = (a[1].positive * 8) + (a[1].saved * 7) + (a[1].opened * 5) + a[1].dwelled;
      const right = (b[1].positive * 8) + (b[1].saved * 7) + (b[1].opened * 5) + b[1].dwelled;
      return right - left;
    })
    .slice(0, limit));
}

function updateMap(
  map: Record<string, FrontierBehaviorAggregate>,
  keys: string[],
  event: FrontierBehaviorEvent,
  now: string
): Record<string, FrontierBehaviorAggregate> {
  const next = { ...map };
  for (const key of keys.filter(Boolean)) next[key] = touchAggregate(next[key], event, now);
  return next;
}

export function applyBehaviorEvent(
  model: FrontierBehaviorModel,
  item: FrontierItem,
  event: FrontierBehaviorEvent,
  date = new Date()
): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  const now = date.toISOString();
  const bucket = timeBucket(date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const format = formatForItem(item);
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
    ], event, now), 128),
    lastActiveAt: now,
  };
}

export function startBehaviorSession(model: FrontierBehaviorModel, date = new Date()): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  const now = date.toISOString();
  const last = model.lastActiveAt ? new Date(model.lastActiveAt).getTime() : 0;
  const startsNew = !last || date.getTime() - last > SESSION_GAP_MS;
  return {
    ...model,
    sessions: model.sessions + (startsNew ? 1 : 0),
    sessionStartedAt: startsNew ? now : (model.sessionStartedAt ?? now),
    lastActiveAt: now,
  };
}

export function endBehaviorSession(model: FrontierBehaviorModel, date = new Date()): FrontierBehaviorModel {
  if (!model.implicitLearning || !model.sessionStartedAt) return model;
  const started = new Date(model.sessionStartedAt).getTime();
  const elapsed = Math.max(0, Math.min(date.getTime() - started, 4 * 60 * 60_000));
  return {
    ...model,
    totalActiveMs: model.totalActiveMs + elapsed,
    sessionStartedAt: undefined,
    lastActiveAt: date.toISOString(),
  };
}

export function recordLayoutUse(model: FrontierBehaviorModel, layout: FrontierLayoutMode): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  return {
    ...model,
    layoutUses: { ...model.layoutUses, [layout]: model.layoutUses[layout] + 1 },
    lastActiveAt: new Date().toISOString(),
  };
}

export function recordViewUse(model: FrontierBehaviorModel, view: FrontierView): FrontierBehaviorModel {
  if (!model.implicitLearning) return model;
  return {
    ...model,
    viewUses: { ...model.viewUses, [view]: model.viewUses[view] + 1 },
    lastActiveAt: new Date().toISOString(),
  };
}

export function aggregatePreference(aggregate?: FrontierBehaviorAggregate): { score: number; confidence: number } {
  if (!aggregate || aggregate.shown < 2) return { score: 0, confidence: 0 };
  const engaged = aggregate.dwelled * 0.24 + aggregate.expanded * 0.48 + aggregate.opened * 0.82 + aggregate.saved * 1.05 + aggregate.positive * 1.15;
  const negative = aggregate.negative * 1.2;
  const shown = Math.max(1, aggregate.shown);
  const positiveRate = (engaged - negative) / shown;
  const quietSkipRate = Math.max(0, (shown - Math.min(shown, aggregate.dwelled + aggregate.expanded + aggregate.opened + aggregate.saved + aggregate.positive)) / shown - 0.78);
  const skipPenalty = shown >= 12 ? quietSkipRate * 0.32 : 0;
  const score = Math.max(-1, Math.min(1.2, positiveRate - skipPenalty));
  const evidence = aggregate.shown + aggregate.opened * 2 + aggregate.saved * 3 + aggregate.positive * 3 + aggregate.negative * 3;
  return { score, confidence: Math.min(1, evidence / 18) };
}

export function behavioralAdjustment(item: FrontierItem, model?: FrontierBehaviorModel, date = new Date()): number {
  if (!model?.implicitLearning) return 0;
  const bucket = timeBucket(date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const format = formatForItem(item);
  const signals: Array<[FrontierBehaviorAggregate | undefined, number]> = [
    [model.laneStats[item.lane], 0.055],
    [model.sourceStats[item.sourceKind], 0.018],
    [model.sourceStats[item.sourceLabel.toLowerCase()], 0.016],
    [model.formatStats[format], 0.025],
    [model.contextStats[`${bucket}:${item.lane}`], 0.04],
    [model.contextStats[`${weekday}:${item.lane}`], 0.022],
    [model.contextStats[`${bucket}:${format}`], 0.018],
  ];
  for (const tag of item.tags.slice(0, 5)) signals.push([model.topicStats[tag.toLowerCase()], 0.018]);

  return signals.reduce((sum, [aggregate, weight]) => {
    const preference = aggregatePreference(aggregate);
    return sum + preference.score * preference.confidence * weight;
  }, 0);
}

export type FrontierHabitInsight = {
  label: string;
  detail: string;
  confidence: number;
};

function strongestEntry(stats: Record<string, FrontierBehaviorAggregate>): [string, FrontierBehaviorAggregate] | undefined {
  return Object.entries(stats)
    .map(([key, value]) => ({ key, value, pref: aggregatePreference(value) }))
    .filter((entry) => entry.pref.confidence >= 0.18 && entry.pref.score > 0.12)
    .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))[0]
    ? (() => {
        const best = Object.entries(stats)
          .map(([key, value]) => ({ key, value, pref: aggregatePreference(value) }))
          .filter((entry) => entry.pref.confidence >= 0.18 && entry.pref.score > 0.12)
          .sort((a, b) => (b.pref.score * b.pref.confidence) - (a.pref.score * a.pref.confidence))[0];
        return best ? [best.key, best.value] as [string, FrontierBehaviorAggregate] : undefined;
      })()
    : undefined;
}

export function summarizeHabits(model: FrontierBehaviorModel): FrontierHabitInsight[] {
  const insights: FrontierHabitInsight[] = [];
  const lane = strongestEntry(model.laneStats);
  if (lane) {
    const pref = aggregatePreference(lane[1]);
    insights.push({
      label: 'Pulls you in',
      detail: `${FRONTIER_LANE_MAP[lane[0] as keyof typeof FRONTIER_LANE_MAP]?.shortLabel ?? lane[0]} is earning unusually strong engagement.`,
      confidence: pref.confidence,
    });
  }
  const format = strongestEntry(model.formatStats);
  if (format) {
    const pref = aggregatePreference(format[1]);
    insights.push({ label: 'Format', detail: `${format[0]} signals are getting more of your attention.`, confidence: pref.confidence });
  }
  const time = strongestEntry(model.timeStats);
  if (time) {
    const pref = aggregatePreference(time[1]);
    insights.push({ label: 'Rhythm', detail: `${time[0]} is becoming a high-engagement FRONTIER window.`, confidence: pref.confidence });
  }
  const preferredLayout = model.layoutUses.feed === model.layoutUses.desk ? undefined : model.layoutUses.feed > model.layoutUses.desk ? 'Feed' : 'Desk';
  const layoutTotal = model.layoutUses.feed + model.layoutUses.desk;
  if (preferredLayout && layoutTotal >= 3) {
    insights.push({ label: 'Reading mode', detail: `You choose ${preferredLayout} more often.`, confidence: Math.min(1, layoutTotal / 12) });
  }
  if (model.sessions >= 2 && model.totalActiveMs > 0) {
    const avgMinutes = Math.max(1, Math.round(model.totalActiveMs / model.sessions / 60_000));
    insights.push({ label: 'Session shape', detail: `A typical visit is about ${avgMinutes} minute${avgMinutes === 1 ? '' : 's'}.`, confidence: Math.min(1, model.sessions / 10) });
  }
  return insights.slice(0, 5);
}
