import { formatForItem, timeBucket } from './behavior';
import type { FrontierBehaviorAggregate, FrontierBehaviorModel, FrontierItem } from './types';
import type { FrontierAmbientReactionKind } from './reaction';

const MAX_TOPICS = 96;

export type FrontierAmbientBehaviorAggregate = FrontierBehaviorAggregate & {
  ambientAffinity?: number;
  ambientInterest?: number;
  ambientSurprise?: number;
  ambientFriction?: number;
  ambientEvidence?: number;
};

export type FrontierAmbientBehaviorEvent = {
  kind: 'ambient_reaction' | 'ambient_retraction';
  ambientReaction: FrontierAmbientReactionKind;
  confidence: number;
  intensity: number;
  durationMs: number;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

/**
 * Converts a sparse, already-qualified reaction cue into a bounded evidence unit.
 * This is accounting strength only, not preference strength. The empirical-Bayes
 * learner applies a second, much smaller multiplier before it can affect ranking.
 */
export function ambientEvidenceForEvent(event: FrontierAmbientBehaviorEvent): number {
  const confidence = clamp(event.confidence);
  const intensity = clamp(event.intensity);
  const duration = Math.max(0, Math.min(4_000, Number.isFinite(event.durationMs) ? event.durationMs : 0));
  const durationWeight = Math.max(0.55, Math.min(1.25, duration / 1_500));
  return confidence * (0.55 + intensity * 0.45) * durationWeight;
}

function debit(value: number | undefined, amount: number): number {
  const next = Math.max(0, (value ?? 0) - amount);
  return next < 1e-9 ? 0 : next;
}

function touchAggregate(
  aggregate: FrontierBehaviorAggregate | undefined,
  event: FrontierAmbientBehaviorEvent,
  now: string,
): FrontierAmbientBehaviorAggregate {
  const current = (aggregate ?? {
    shown: 0,
    dwelled: 0,
    expanded: 0,
    opened: 0,
    saved: 0,
    positive: 0,
    negative: 0,
    dwellMs: 0,
  }) as FrontierAmbientBehaviorAggregate;
  const next: FrontierAmbientBehaviorAggregate = {
    ...current,
    // A correction is an accounting debit, not fresh preference evidence.
    lastAt: event.kind === 'ambient_retraction' ? current.lastAt : now,
  };
  const evidence = ambientEvidenceForEvent(event);
  if (evidence <= 0) return next;

  if (event.kind === 'ambient_retraction') {
    if (event.ambientReaction === 'friction') {
      next.ambientFriction = debit(next.ambientFriction, evidence);
      return next;
    }
    next.ambientEvidence = debit(next.ambientEvidence, evidence);
    if (event.ambientReaction === 'affinity') next.ambientAffinity = debit(next.ambientAffinity, evidence);
    if (event.ambientReaction === 'interest') next.ambientInterest = debit(next.ambientInterest, evidence);
    if (event.ambientReaction === 'surprise') next.ambientSurprise = debit(next.ambientSurprise, evidence);
    return next;
  }

  // Friction stays inspectable for UX diagnostics but can never become generic
  // preference evidence or negative preference authority.
  if (event.ambientReaction === 'friction') {
    next.ambientFriction = (next.ambientFriction ?? 0) + evidence;
    return next;
  }
  next.ambientEvidence = (next.ambientEvidence ?? 0) + evidence;
  if (event.ambientReaction === 'affinity') next.ambientAffinity = (next.ambientAffinity ?? 0) + evidence;
  if (event.ambientReaction === 'interest') next.ambientInterest = (next.ambientInterest ?? 0) + evidence;
  if (event.ambientReaction === 'surprise') next.ambientSurprise = (next.ambientSurprise ?? 0) + evidence;
  return next;
}

function updateMap(
  map: Record<string, FrontierBehaviorAggregate>,
  keys: Array<string | undefined>,
  event: FrontierAmbientBehaviorEvent,
  now: string,
): Record<string, FrontierBehaviorAggregate> {
  const next = { ...map };
  for (const key of keys) {
    if (!key) continue;
    // Retraction must never manufacture a preference key that did not exist.
    if (event.kind === 'ambient_retraction' && !next[key]) continue;
    next[key] = touchAggregate(next[key], event, now);
  }
  return next;
}

function trimStats(stats: Record<string, FrontierBehaviorAggregate>, limit = MAX_TOPICS): Record<string, FrontierBehaviorAggregate> {
  const entries = Object.entries(stats);
  if (entries.length <= limit) return stats;
  return Object.fromEntries(entries
    .sort((a, b) => {
      const score = (value: FrontierBehaviorAggregate) => {
        const ambient = value as FrontierAmbientBehaviorAggregate;
        return value.positive * 8
          + value.saved * 7
          + value.opened * 5
          + Math.min(8, value.dwellMs / 12_000)
          + (ambient.ambientAffinity ?? 0) * 0.2
          + (ambient.ambientInterest ?? 0) * 0.1
          + (ambient.ambientSurprise ?? 0) * 0.04;
      };
      return score(b[1]) - score(a[1]);
    })
    .slice(0, limit));
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

/**
 * Applies passive cue accounting without widening the explicit behavior-event API.
 * Current-session ranking remains frozen because rankingSnapshot is never mutated.
 * Retractions remain authoritative even after implicit learning is disabled so a
 * user correction cannot trap stale ambient evidence in the model.
 */
export function applyAmbientBehaviorEvent(
  model: FrontierBehaviorModel,
  item: FrontierItem,
  event: FrontierAmbientBehaviorEvent,
  date = new Date(),
): FrontierBehaviorModel {
  if (item.sourceKind === 'local') return model;
  if (!model.implicitLearning && event.kind !== 'ambient_retraction') return model;

  const now = date.toISOString();
  const bucket = timeBucket(date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const format = formatForItem(item);
  const novelty = noveltyBucket(item);
  const depth = depthBucket(item);
  const topicKeys = [...new Set(item.tags.slice(0, 8).map((tag) => tag.toLowerCase().trim()).filter(Boolean))];

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
    lastActiveAt: event.kind === 'ambient_retraction' ? model.lastActiveAt : now,
  };
}

/**
 * Returns the tiny pseudo-count contribution admitted into the empirical-Bayes
 * learner. Friction is intentionally absent. Even a strong affinity cue is an
 * order of magnitude weaker than an explicit save or positive vote.
 */
export function ambientPreferencePseudoCount(aggregate: FrontierBehaviorAggregate): number {
  const ambient = aggregate as FrontierAmbientBehaviorAggregate;
  return (ambient.ambientAffinity ?? 0) * 0.1
    + (ambient.ambientInterest ?? 0) * 0.05
    + (ambient.ambientSurprise ?? 0) * 0.02;
}

export function ambientSupportPseudoCount(aggregate: FrontierBehaviorAggregate): number {
  const ambient = aggregate as FrontierAmbientBehaviorAggregate;
  return (ambient.ambientEvidence ?? 0) * 0.12;
}
