import type { FrontierAmbientReaction, FrontierAmbientReactionKind } from './reaction';

const STORAGE_KEY = 'frontier-reaction-trust-v1';

export type ReactionTrustStat = {
  observed: number;
  confirmed: number;
  contradicted: number;
  confidenceSum: number;
  lastAt?: number;
};

type ReactionTrustState = Partial<Record<FrontierAmbientReactionKind, ReactionTrustStat>>;

const EMPTY_STAT: ReactionTrustStat = {
  observed: 0,
  confirmed: 0,
  contradicted: 0,
  confidenceSum: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function readState(): ReactionTrustState {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as ReactionTrustState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(state: ReactionTrustState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preference learning must never break the feed if storage is unavailable.
  }
}

export function reactionTrustAuthority(stat: ReactionTrustStat | undefined): number {
  if (!stat) return 0.85;
  const reviewed = Math.max(0, stat.confirmed) + Math.max(0, stat.contradicted);
  if (!reviewed) return 0.85;
  // Beta(2, 3) prior: ambient cues begin skeptical and earn authority only after
  // explicit confirmation. Even a perfect history remains far below explicit
  // click/save/reaction authority because this multiplier is tightly bounded.
  const posterior = (2 + Math.max(0, stat.confirmed)) / (5 + reviewed);
  return clamp(0.55 + posterior * 0.75, 0.65, 1.15);
}

export function reactionTrustAccuracy(stat: ReactionTrustStat | undefined): number | undefined {
  if (!stat) return undefined;
  const reviewed = Math.max(0, stat.confirmed) + Math.max(0, stat.contradicted);
  if (!reviewed) return undefined;
  return Math.max(0, stat.confirmed) / reviewed;
}

export function getReactionTrust(kind: FrontierAmbientReactionKind): ReactionTrustStat {
  return { ...EMPTY_STAT, ...readState()[kind] };
}

export function recordReactionObservation(reaction: FrontierAmbientReaction): ReactionTrustStat {
  const state = readState();
  const previous = { ...EMPTY_STAT, ...state[reaction.kind] };
  const next: ReactionTrustStat = {
    ...previous,
    observed: previous.observed + 1,
    confidenceSum: previous.confidenceSum + clamp(reaction.confidence, 0, 1),
    lastAt: Date.now(),
  };
  writeState({ ...state, [reaction.kind]: next });
  return next;
}

export function recordReactionReview(kind: FrontierAmbientReactionKind, confirmed: boolean): ReactionTrustStat {
  const state = readState();
  const previous = { ...EMPTY_STAT, ...state[kind] };
  const next: ReactionTrustStat = {
    ...previous,
    confirmed: previous.confirmed + (confirmed ? 1 : 0),
    contradicted: previous.contradicted + (confirmed ? 0 : 1),
    lastAt: Date.now(),
  };
  writeState({ ...state, [kind]: next });
  return next;
}

export function applyReactionTrust(reaction: FrontierAmbientReaction): FrontierAmbientReaction {
  // Friction is useful for UX diagnostics and suggestions, but facial tension is
  // too ambiguous to become preference authority without an explicit action.
  if (reaction.kind === 'friction') return { ...reaction, confidence: 0, intensity: 0 };
  const authority = reactionTrustAuthority(getReactionTrust(reaction.kind));
  return {
    ...reaction,
    confidence: clamp(reaction.confidence * authority, 0, 1),
    intensity: clamp(reaction.intensity * authority, 0, 1),
  };
}

export function clearReactionTrust(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort local reset.
  }
}