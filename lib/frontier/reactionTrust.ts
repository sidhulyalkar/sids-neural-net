import type { FrontierAmbientReaction, FrontierAmbientReactionKind } from './reaction';

const STORAGE_KEY = 'frontier-reaction-trust-v1';
const KINDS: FrontierAmbientReactionKind[] = ['affinity', 'interest', 'surprise', 'friction'];
const MAX_TRUST_COUNT = 10_000_000;

export type ReactionTrustStat = {
  observed: number;
  confirmed: number;
  contradicted: number;
  confidenceSum: number;
  lastAt?: number;
};

export type ReactionTrustState = Partial<Record<FrontierAmbientReactionKind, ReactionTrustStat>>;

const EMPTY_STAT: ReactionTrustStat = {
  observed: 0,
  confirmed: 0,
  contradicted: 0,
  confidenceSum: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function sanitizeStat(value: unknown): ReactionTrustStat | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ReactionTrustStat>;
  const stat: ReactionTrustStat = {
    observed: Math.max(0, Math.floor(Number(candidate.observed) || 0)),
    confirmed: Math.max(0, Math.floor(Number(candidate.confirmed) || 0)),
    contradicted: Math.max(0, Math.floor(Number(candidate.contradicted) || 0)),
    confidenceSum: Math.max(0, Number(candidate.confidenceSum) || 0),
  };
  if (Number.isFinite(candidate.lastAt)) stat.lastAt = candidate.lastAt;
  return stat;
}

function sanitizeState(value: unknown): ReactionTrustState {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  const next: ReactionTrustState = {};
  for (const kind of KINDS) {
    const stat = sanitizeStat(candidate[kind]);
    if (stat) next[kind] = stat;
  }
  return next;
}

function strictStat(value: unknown): ReactionTrustStat | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(['observed', 'confirmed', 'contradicted', 'confidenceSum', 'lastAt']);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) return null;
  const observed = candidate.observed;
  const confirmed = candidate.confirmed;
  const contradicted = candidate.contradicted;
  const confidenceSum = candidate.confidenceSum;
  if (typeof observed !== 'number' || !Number.isInteger(observed) || observed < 0 || observed > MAX_TRUST_COUNT) return null;
  if (typeof confirmed !== 'number' || !Number.isInteger(confirmed) || confirmed < 0 || confirmed > MAX_TRUST_COUNT) return null;
  if (typeof contradicted !== 'number' || !Number.isInteger(contradicted) || contradicted < 0 || contradicted > MAX_TRUST_COUNT) return null;
  if (confirmed + contradicted > observed) return null;
  if (typeof confidenceSum !== 'number' || !Number.isFinite(confidenceSum) || confidenceSum < 0 || confidenceSum > observed + 1e-9) return null;
  const stat: ReactionTrustStat = { observed, confirmed, contradicted, confidenceSum };
  if (candidate.lastAt !== undefined) {
    if (typeof candidate.lastAt !== 'number' || !Number.isFinite(candidate.lastAt) || candidate.lastAt < 0) return null;
    stat.lastAt = candidate.lastAt;
  }
  return stat;
}

export function parseReactionTrustState(value: unknown): ReactionTrustState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !KINDS.includes(key as FrontierAmbientReactionKind))) return null;
  const next: ReactionTrustState = {};
  for (const kind of KINDS) {
    if (candidate[kind] === undefined) continue;
    const stat = strictStat(candidate[kind]);
    if (!stat) return null;
    next[kind] = stat;
  }
  return next;
}

function readState(): ReactionTrustState {
  if (typeof window === 'undefined') return {};
  try {
    return sanitizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

function writeState(state: ReactionTrustState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
    return true;
  } catch {
    // Preference learning must never break the feed if storage is unavailable.
    return false;
  }
}

export function reactionTrustAccuracy(stat: ReactionTrustStat | undefined): number | undefined {
  if (!stat) return undefined;
  const reviewed = Math.max(0, stat.confirmed) + Math.max(0, stat.contradicted);
  if (!reviewed) return undefined;
  return Math.max(0, stat.confirmed) / reviewed;
}

export function reactionTrustQuarantined(stat: ReactionTrustStat | undefined): boolean {
  if (!stat) return false;
  const reviewed = Math.max(0, stat.confirmed) + Math.max(0, stat.contradicted);
  const accuracy = reactionTrustAccuracy(stat);
  return reviewed >= 5 && accuracy !== undefined && accuracy < 0.4;
}

export function reactionTrustAuthority(stat: ReactionTrustStat | undefined): number {
  if (!stat) return 0.85;
  const confirmed = Math.max(0, stat.confirmed);
  const contradicted = Math.max(0, stat.contradicted);
  const reviewed = confirmed + contradicted;
  if (!reviewed) return 0.85;

  // Quarantine is a real authority boundary, not a label. We keep observing and
  // reviewing the cue locally so it can later recover, but it contributes exactly
  // zero recommendation evidence while agreement remains below the gate.
  if (reactionTrustQuarantined(stat)) return 0;

  // Beta(2, 3) prior: ambient cues begin skeptical and earn authority only after
  // explicit confirmation. Outside quarantine the continuous multiplier remains
  // tightly bounded and well below the structural authority of explicit actions.
  const posterior = (2 + confirmed) / (5 + reviewed);
  const evidence = 1 - Math.exp(-reviewed / 5);
  const learned = 0.15 + posterior * 1.05;
  return clamp(0.85 * (1 - evidence) + learned * evidence, 0.15, 1.15);
}

export function getReactionTrust(kind: FrontierAmbientReactionKind): ReactionTrustStat {
  return { ...EMPTY_STAT, ...readState()[kind] };
}

export function getReactionTrustState(): ReactionTrustState {
  return readState();
}

export function importReactionTrustState(value: unknown): boolean {
  const parsed = parseReactionTrustState(value);
  return parsed ? writeState(parsed) : false;
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
