import type { FrontierReaction } from './types';
import {
  listenFrontierSemanticTelemetry,
  type FrontierSemanticTelemetry,
  type FrontierSemanticTelemetryKind,
} from './vector/telemetryEngine';

export const FRONTIER_DECISION_LEDGER_KEY = 'frontier-decision-ledger-v1';
export const FRONTIER_DECISION_SESSION_KEY = 'frontier-decision-session-v1';
export const FRONTIER_DECISION_MAX_RECORDS = 128;
export const FRONTIER_DECISION_MAX_EXPOSURES = 64;
export const FRONTIER_DECISION_ATTRIBUTION_WINDOW_MS = 4 * 60 * 60 * 1000;
export const FRONTIER_DECISION_EXPLORE_THRESHOLD = 0.55;

const DECISION_REUSE_WINDOW_MS = 15 * 60 * 1000;
const LEDGER_WRITE_COALESCE_MS = 120;

export type FrontierDecisionPolicyMode = 'passive' | 'search' | 'explore';

export type FrontierDecisionExposure = {
  itemId: string;
  upstreamIndex: number;
  displayedIndex: number;
};

export type FrontierDecisionOutcome = {
  itemId: string;
  firstAt: number;
  lastAt: number;
  maxDwellMs?: number;
  maxDepth?: number;
  expanded?: boolean;
  opened?: boolean;
  saved?: boolean;
  reaction?: FrontierReaction;
};

export type FrontierDecisionRecord = {
  id: string;
  sessionId: string;
  at: number;
  lastSeenAt: number;
  signature: string;
  policyMode: FrontierDecisionPolicyMode;
  semanticEnabled: boolean;
  streamEpoch: number;
  exposures: FrontierDecisionExposure[];
  outcomes: FrontierDecisionOutcome[];
};

export type FrontierDecisionInput = {
  sessionId: string;
  at: number;
  policyMode: FrontierDecisionPolicyMode;
  semanticEnabled: boolean;
  streamEpoch: number;
  upstreamIds: string[];
  displayedIds: string[];
};

type DecisionOutcomeInput = Pick<FrontierSemanticTelemetry, 'kind' | 'at' | 'dwellMs' | 'depth' | 'reaction'> & {
  itemId: string;
};

let fallbackSessionId: string | undefined;
let browserLedgerCache: FrontierDecisionRecord[] | undefined;
let ledgerWriteTimer: number | undefined;
let ledgerLifecycleBound = false;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const id of ids) {
    const normalized = String(id ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= FRONTIER_DECISION_MAX_EXPOSURES) break;
  }
  return output;
}

export function frontierDecisionPolicyMode(
  query: string,
  explorationTemperature: number,
): FrontierDecisionPolicyMode {
  // An explicit query is direct intent even when search temporarily raises the
  // exploration temperature. Normal FRONTIER carries a small background
  // exploration temperature, so only deliberate high-temperature excursions
  // receive the `explore` label.
  if (query.trim()) return 'search';
  if (explorationTemperature >= FRONTIER_DECISION_EXPLORE_THRESHOLD) return 'explore';
  return 'passive';
}

export function buildFrontierDecision(input: FrontierDecisionInput): FrontierDecisionRecord | undefined {
  const displayedIds = uniqueIds(input.displayedIds);
  if (!displayedIds.length) return undefined;

  const upstream = new Map<string, number>();
  input.upstreamIds.forEach((id, index) => {
    if (!upstream.has(id)) upstream.set(id, index);
  });
  const exposures = displayedIds.map((itemId, displayedIndex) => ({
    itemId,
    upstreamIndex: upstream.get(itemId) ?? -1,
    displayedIndex,
  }));
  const signature = stableHash([
    input.policyMode,
    input.semanticEnabled ? 'semantic' : 'plain',
    String(input.streamEpoch),
    ...exposures.map((entry) => `${entry.itemId}:${entry.upstreamIndex}:${entry.displayedIndex}`),
  ].join('|'));

  return {
    id: `${input.sessionId}:${input.at.toString(36)}:${signature}`,
    sessionId: input.sessionId,
    at: input.at,
    lastSeenAt: input.at,
    signature,
    policyMode: input.policyMode,
    semanticEnabled: input.semanticEnabled,
    streamEpoch: input.streamEpoch,
    exposures,
    outcomes: [],
  };
}

export function upsertFrontierDecision(
  records: FrontierDecisionRecord[],
  decision: FrontierDecisionRecord,
): FrontierDecisionRecord[] {
  const next = records.slice(-FRONTIER_DECISION_MAX_RECORDS);
  const latest = next[next.length - 1];
  if (
    latest
    && latest.sessionId === decision.sessionId
    && latest.signature === decision.signature
    && decision.at >= latest.lastSeenAt
    && decision.at - latest.lastSeenAt <= DECISION_REUSE_WINDOW_MS
  ) {
    next[next.length - 1] = { ...latest, lastSeenAt: decision.at };
    return next;
  }
  next.push(decision);
  return next.slice(-FRONTIER_DECISION_MAX_RECORDS);
}

function roundedDwellMs(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return undefined;
  return Math.round(clamp(value ?? 0, 0, 120_000) / 500) * 500;
}

function roundedDepth(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.round(clamp(value ?? 0, 0, 1) * 20) / 20;
}

function mergeOutcome(
  previous: FrontierDecisionOutcome | undefined,
  input: DecisionOutcomeInput,
): FrontierDecisionOutcome {
  const next: FrontierDecisionOutcome = previous
    ? { ...previous, lastAt: Math.max(previous.lastAt, input.at) }
    : { itemId: input.itemId, firstAt: input.at, lastAt: input.at };

  switch (input.kind) {
    case 'visibility-depth': {
      const depth = roundedDepth(input.depth);
      if (depth !== undefined) next.maxDepth = Math.max(next.maxDepth ?? 0, depth);
      break;
    }
    case 'dwell': {
      const dwell = roundedDwellMs(input.dwellMs);
      if (dwell !== undefined) next.maxDwellMs = Math.max(next.maxDwellMs ?? 0, dwell);
      break;
    }
    case 'expand':
      next.expanded = true;
      break;
    case 'open':
      next.opened = true;
      break;
    case 'save':
      next.saved = true;
      break;
    case 'reaction':
      if (input.reaction) next.reaction = input.reaction;
      break;
  }
  return next;
}

export function attributeFrontierDecisionOutcome(
  records: FrontierDecisionRecord[],
  input: DecisionOutcomeInput,
  sessionId: string,
): FrontierDecisionRecord[] {
  if (!input.itemId || !Number.isFinite(input.at)) return records;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const decision = records[index];
    if (decision.sessionId !== sessionId) continue;
    if (input.at < decision.at) continue;
    if (input.at - decision.lastSeenAt > FRONTIER_DECISION_ATTRIBUTION_WINDOW_MS) break;
    if (!decision.exposures.some((entry) => entry.itemId === input.itemId)) continue;

    const outcomeIndex = decision.outcomes.findIndex((entry) => entry.itemId === input.itemId);
    const previous = outcomeIndex >= 0 ? decision.outcomes[outcomeIndex] : undefined;
    const outcome = mergeOutcome(previous, input);
    const outcomes = [...decision.outcomes];
    if (outcomeIndex >= 0) outcomes[outcomeIndex] = outcome;
    else outcomes.push(outcome);

    const next = [...records];
    next[index] = { ...decision, outcomes };
    return next;
  }
  return records;
}

function parseLedger(value: string | null): FrontierDecisionRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is FrontierDecisionRecord => {
      if (!record || typeof record !== 'object') return false;
      const candidate = record as Partial<FrontierDecisionRecord>;
      return typeof candidate.id === 'string'
        && typeof candidate.sessionId === 'string'
        && typeof candidate.at === 'number'
        && typeof candidate.lastSeenAt === 'number'
        && typeof candidate.signature === 'string'
        && Array.isArray(candidate.exposures)
        && Array.isArray(candidate.outcomes);
    }).slice(-FRONTIER_DECISION_MAX_RECORDS);
  } catch {
    return [];
  }
}

function mergeLedgers(
  stored: FrontierDecisionRecord[],
  local: FrontierDecisionRecord[],
): FrontierDecisionRecord[] {
  const byId = new Map<string, FrontierDecisionRecord>();
  for (const record of stored) byId.set(record.id, record);
  for (const record of local) byId.set(record.id, record);
  return Array.from(byId.values())
    .sort((left, right) => left.at - right.at || left.id.localeCompare(right.id))
    .slice(-FRONTIER_DECISION_MAX_RECORDS);
}

function readBrowserLedger(): FrontierDecisionRecord[] {
  if (typeof window === 'undefined') return [];
  if (browserLedgerCache) return browserLedgerCache;
  try {
    browserLedgerCache = parseLedger(window.localStorage.getItem(FRONTIER_DECISION_LEDGER_KEY));
  } catch {
    browserLedgerCache = [];
  }
  bindLedgerLifecycle();
  return browserLedgerCache;
}

function flushBrowserLedger(): void {
  if (typeof window === 'undefined' || !browserLedgerCache) return;
  if (ledgerWriteTimer !== undefined) {
    window.clearTimeout(ledgerWriteTimer);
    ledgerWriteTimer = undefined;
  }
  try {
    // Reconcile with another tab only at the coalesced write boundary. The hot
    // viewport path never reparses the full persisted ledger.
    const stored = parseLedger(window.localStorage.getItem(FRONTIER_DECISION_LEDGER_KEY));
    browserLedgerCache = mergeLedgers(stored, browserLedgerCache);
    window.localStorage.setItem(FRONTIER_DECISION_LEDGER_KEY, JSON.stringify(browserLedgerCache));
  } catch {
    // Private mode, quota pressure, or disabled storage must never affect ranking.
  }
}

function bindLedgerLifecycle(): void {
  if (typeof window === 'undefined' || ledgerLifecycleBound) return;
  ledgerLifecycleBound = true;
  window.addEventListener('pagehide', flushBrowserLedger);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBrowserLedger();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== FRONTIER_DECISION_LEDGER_KEY) return;
    const external = parseLedger(event.newValue);
    browserLedgerCache = browserLedgerCache ? mergeLedgers(external, browserLedgerCache) : external;
  });
}

function writeBrowserLedger(records: FrontierDecisionRecord[]): void {
  if (typeof window === 'undefined') return;
  browserLedgerCache = records.slice(-FRONTIER_DECISION_MAX_RECORDS);
  bindLedgerLifecycle();
  if (ledgerWriteTimer !== undefined) return;
  ledgerWriteTimer = window.setTimeout(flushBrowserLedger, LEDGER_WRITE_COALESCE_MS);
}

function newSessionId(now = Date.now()): string {
  const entropy = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.random().toString(36).slice(2, 10);
  return `s${now.toString(36)}${entropy}`;
}

export function getFrontierDecisionSessionId(): string {
  if (typeof window === 'undefined') return fallbackSessionId ??= newSessionId();
  try {
    const existing = window.sessionStorage.getItem(FRONTIER_DECISION_SESSION_KEY);
    if (existing) return existing;
    const created = newSessionId();
    window.sessionStorage.setItem(FRONTIER_DECISION_SESSION_KEY, created);
    return created;
  } catch {
    return fallbackSessionId ??= newSessionId();
  }
}

export function recordFrontierDecision(
  input: Omit<FrontierDecisionInput, 'sessionId' | 'at'> & { at?: number },
): FrontierDecisionRecord | undefined {
  const decision = buildFrontierDecision({
    ...input,
    at: input.at ?? Date.now(),
    sessionId: getFrontierDecisionSessionId(),
  });
  if (!decision) return undefined;
  writeBrowserLedger(upsertFrontierDecision(readBrowserLedger(), decision));
  return decision;
}

export function recordFrontierDecisionVisibility(
  itemId: string,
  depth: number,
  at = Date.now(),
): void {
  const current = readBrowserLedger();
  const next = attributeFrontierDecisionOutcome(current, {
    kind: 'visibility-depth',
    itemId,
    at,
    depth,
  }, getFrontierDecisionSessionId());
  if (next !== current) writeBrowserLedger(next);
}

export function recordFrontierDecisionOutcome(event: FrontierSemanticTelemetry): void {
  const current = readBrowserLedger();
  const next = attributeFrontierDecisionOutcome(current, {
    kind: event.kind,
    itemId: event.item.id,
    at: event.at,
    dwellMs: event.dwellMs,
    depth: event.depth,
    reaction: event.reaction,
  }, getFrontierDecisionSessionId());
  if (next !== current) writeBrowserLedger(next);
}

export function listenFrontierDecisionOutcomes(): () => void {
  return listenFrontierSemanticTelemetry(recordFrontierDecisionOutcome);
}

export function readFrontierDecisionLedger(): FrontierDecisionRecord[] {
  return readBrowserLedger();
}

export function clearFrontierDecisionLedger(): void {
  if (typeof window === 'undefined') return;
  if (ledgerWriteTimer !== undefined) {
    window.clearTimeout(ledgerWriteTimer);
    ledgerWriteTimer = undefined;
  }
  browserLedgerCache = [];
  try { window.localStorage.removeItem(FRONTIER_DECISION_LEDGER_KEY); } catch {}
}

export function frontierDecisionOutcomeKinds(): FrontierSemanticTelemetryKind[] {
  return ['dwell', 'expand', 'open', 'save', 'reaction', 'visibility-depth'];
}
