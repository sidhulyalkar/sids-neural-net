/// <reference lib="webworker" />

import {
  FRONTIER_FORAGED_SOURCE_CHANNEL,
  readDueFrontierForagedSources,
  recordFrontierForagedSourceYield,
} from '@/lib/frontier/forage/sourceRoster';
import { addFrontierCandidates, readFrontierCandidates } from '@/lib/frontier/live/candidatePool';
import type {
  FrontierDaemonConfig,
  FrontierDaemonRequest,
  FrontierDaemonResponse,
  FrontierDaemonStatus,
} from '@/lib/frontier/live/daemonProtocol';
import {
  frontierDaemonPollInterval,
  runFrontierDaemonLeadership,
  type FrontierLockManagerLike,
} from '@/lib/frontier/live/leaderElection';
import {
  filterUnseenFrontierItems,
  frontierItemIdentityKey,
  frontierSeenSignatures,
  listenFrontierSeenSignatures,
} from '@/lib/frontier/live/seenLedger';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from '@/lib/frontier/types';

const CHANNEL_NAME = 'frontier-live-daemon-v1';
const MIN_WIDE_BATCH = 6;
const FETCH_TIMEOUT_MS = 28_000;
const PRESENCE_TTL_MS = 90_000;
const FORAGED_SOURCES_PER_POLL = 3;
const instanceId = `daemon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

type InternalMessage =
  | { type: 'fresh'; origin: string; items: FrontierItem[]; generatedAt: string; sources: FrontierSourceStatus[] }
  | { type: 'poll-request'; origin: string; reason: string }
  | { type: 'presence'; origin: string; at: number; visible: boolean };

type Presence = { at: number; visible: boolean; heartbeatAt: number };

const defaultConfig: FrontierDaemonConfig = {
  focusSignature: '',
  visible: true,
  lastActivityAt: Date.now(),
  excludeSignatures: [],
};

let config = defaultConfig;
let configured = false;
let stopped = false;
let leadershipController: AbortController | undefined;
let wakeResolver: (() => void) | undefined;
let channel: BroadcastChannel | undefined;
let rosterChannel: BroadcastChannel | undefined;
let presenceTimer: number | undefined;
let unsubscribeSeen: (() => void) | undefined;
const peerPresence = new Map<string, Presence>();
const locallySeen = new Set<string>();

let status: FrontierDaemonStatus = {
  leader: false,
  polling: false,
  consecutiveFailures: 0,
  consecutiveEmpty: 0,
  mode: 'web-lock',
};

function post(message: FrontierDaemonResponse): void {
  self.postMessage(message);
}

function publishStatus(patch: Partial<FrontierDaemonStatus> = {}): void {
  status = { ...status, ...patch };
  post({ type: 'status', status });
}

function excluded(item: FrontierItem): boolean {
  const configuredExclusions = new Set(config.excludeSignatures);
  return frontierSeenSignatures(item).some((signature) => configuredExclusions.has(signature) || locallySeen.has(signature));
}

async function unseenAndAllowed(items: FrontierItem[]): Promise<FrontierItem[]> {
  const exact = await filterUnseenFrontierItems(items);
  return exact.filter((item) => !excluded(item));
}

function dedupe(items: FrontierItem[]): FrontierItem[] {
  const map = new Map<string, FrontierItem>();
  for (const item of items) {
    const key = frontierItemIdentityKey(item);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function mergeSources(left: FrontierSourceStatus[], right: FrontierSourceStatus[]): FrontierSourceStatus[] {
  const map = new Map<string, FrontierSourceStatus>();
  for (const source of [...left, ...right]) {
    const current = map.get(source.id);
    if (!current) map.set(source.id, source);
    else map.set(source.id, {
      ...current,
      ok: current.ok || source.ok,
      count: Math.max(current.count, source.count),
      message: current.ok ? current.message : source.message,
    });
  }
  return Array.from(map.values());
}

function alignedLearnedCandidate(item: FrontierItem): boolean {
  // Learned-source yield is about recent feed purity, not merely freshness.
  // Require credible normalized source quality plus a strong intrinsic
  // relevance/importance signal before a candidate earns aligned-yield credit.
  return item.quality >= 0.7
    && item.baseScore >= 0.66
    && (item.importance >= 0.62 || item.novelty >= 0.68);
}

async function fetchJsonFeed(url: string, leaderSignal: AbortSignal): Promise<FrontierFeedResponse & { error?: string }> {
  const controller = new AbortController();
  const timer = self.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onLeaderAbort = () => controller.abort();
  leaderSignal.addEventListener('abort', onLeaderAbort, { once: true });
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`live feed returned ${response.status}`);
    return await response.json() as FrontierFeedResponse & { error?: string };
  } finally {
    self.clearTimeout(timer);
    leaderSignal.removeEventListener('abort', onLeaderAbort);
  }
}

async function fetchFeed(focusSignature: string, leaderSignal: AbortSignal): Promise<FrontierFeedResponse & { error?: string }> {
  const params = new URLSearchParams({ fresh: '1' });
  if (focusSignature) params.set('focus', focusSignature);
  return fetchJsonFeed(`/api/frontier/feed?${params.toString()}`, leaderSignal);
}

async function fetchForagedFeed(endpoint: string, leaderSignal: AbortSignal): Promise<FrontierFeedResponse & { error?: string }> {
  const params = new URLSearchParams({ mode: 'feed', url: endpoint });
  return fetchJsonFeed(`/api/frontier/forage?${params.toString()}`, leaderSignal);
}

async function pollForagedSources(signal: AbortSignal): Promise<{ items: FrontierItem[]; sources: FrontierSourceStatus[] }> {
  const due = await readDueFrontierForagedSources(FORAGED_SOURCES_PER_POLL, Date.now());
  if (!due.length || signal.aborted) return { items: [], sources: [] };
  const items: FrontierItem[] = [];
  let sources: FrontierSourceStatus[] = [];

  for (const learned of due) {
    if (signal.aborted) break;
    try {
      const feed = await fetchForagedFeed(learned.endpoint, signal);
      const discovered = feed.items ?? [];
      const unseen = await unseenAndAllowed(discovered);
      const aligned = unseen.filter(alignedLearnedCandidate).length;
      items.push(...unseen);
      sources = mergeSources(sources, feed.sources ?? []);
      await recordFrontierForagedSourceYield(learned.id, {
        discovered: discovered.length,
        unseen: unseen.length,
        aligned,
        success: !feed.error,
      });
    } catch {
      await recordFrontierForagedSourceYield(learned.id, { discovered: 0, unseen: 0, aligned: 0, success: false });
    }
  }
  return { items: dedupe(items), sources };
}

async function discover(signal: AbortSignal): Promise<void> {
  publishStatus({ polling: true, nextPollAt: undefined });
  const startedAt = Date.now();
  try {
    const focused = await fetchFeed(config.focusSignature, signal);
    let candidates = await unseenAndAllowed(focused.items ?? []);
    let sources = focused.sources ?? [];
    let generatedAt = focused.generatedAt ?? new Date().toISOString();

    if (!signal.aborted) {
      const learned = await pollForagedSources(signal);
      candidates = dedupe([...candidates, ...learned.items]);
      sources = mergeSources(sources, learned.sources);
    }

    if (candidates.length < MIN_WIDE_BATCH && config.focusSignature && !signal.aborted) {
      const wide = await fetchFeed('', signal);
      const wideCandidates = await unseenAndAllowed(wide.items ?? []);
      candidates = dedupe([...candidates, ...wideCandidates]);
      sources = mergeSources(sources, wide.sources ?? []);
      generatedAt = new Date(Math.max(
        new Date(generatedAt).getTime() || 0,
        new Date(wide.generatedAt ?? '').getTime() || 0
      )).toISOString();
    }

    if (signal.aborted) return;
    const added = await addFrontierCandidates(candidates, startedAt);
    const fresh = await unseenAndAllowed(added);
    const nextEmpty = fresh.length ? 0 : status.consecutiveEmpty + 1;
    publishStatus({
      polling: false,
      lastPollAt: Date.now(),
      consecutiveFailures: 0,
      consecutiveEmpty: nextEmpty,
    });
    if (!fresh.length) return;

    const message: InternalMessage = {
      type: 'fresh',
      origin: instanceId,
      items: fresh,
      generatedAt,
      sources,
    };
    post({ type: 'fresh', items: fresh, generatedAt, sources });
    channel?.postMessage(message);
  } catch (error) {
    if (signal.aborted) return;
    const failures = status.consecutiveFailures + 1;
    publishStatus({ polling: false, lastPollAt: Date.now(), consecutiveFailures: failures });
    post({ type: 'error', message: error instanceof Error ? error.message : 'live daemon poll failed' });
  }
}

function effectivePresence(): { visible: boolean; lastActivityAt: number } {
  const now = Date.now();
  let visible = config.visible;
  let lastActivityAt = config.lastActivityAt;
  for (const [id, peer] of peerPresence) {
    if (now - peer.heartbeatAt > PRESENCE_TTL_MS) {
      peerPresence.delete(id);
      continue;
    }
    visible ||= peer.visible;
    lastActivityAt = Math.max(lastActivityAt, peer.at);
  }
  return { visible, lastActivityAt };
}

function waitForWake(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      self.clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      if (wakeResolver === finish) wakeResolver = undefined;
      resolve();
    };
    const timer = self.setTimeout(finish, ms);
    wakeResolver = finish;
    signal.addEventListener('abort', finish, { once: true });
  });
}

function wakeLeader(): void {
  wakeResolver?.();
}

async function leaderLoop(signal: AbortSignal): Promise<void> {
  publishStatus({ leader: true, mode: 'web-lock' });
  while (!signal.aborted && !stopped) {
    await discover(signal);
    if (signal.aborted || stopped) break;
    const presence = effectivePresence();
    const interval = frontierDaemonPollInterval({
      visible: presence.visible,
      activeRecently: Date.now() - presence.lastActivityAt < 60_000,
      consecutiveEmpty: status.consecutiveEmpty,
      consecutiveFailures: status.consecutiveFailures,
    });
    publishStatus({ nextPollAt: Date.now() + interval });
    await waitForWake(interval, signal);
  }
  publishStatus({ leader: false, polling: false, nextPollAt: undefined });
}

async function fallbackLoop(signal: AbortSignal): Promise<void> {
  publishStatus({ leader: true, mode: 'single-worker-fallback' });
  while (!signal.aborted && !stopped) {
    await discover(signal);
    if (signal.aborted || stopped) break;
    const presence = effectivePresence();
    const interval = frontierDaemonPollInterval({
      visible: presence.visible,
      activeRecently: Date.now() - presence.lastActivityAt < 60_000,
      consecutiveEmpty: status.consecutiveEmpty,
      consecutiveFailures: status.consecutiveFailures,
    });
    publishStatus({ nextPollAt: Date.now() + interval });
    await waitForWake(interval, signal);
  }
}

function broadcastPresence(): void {
  channel?.postMessage({
    type: 'presence',
    origin: instanceId,
    at: config.lastActivityAt,
    visible: config.visible,
  } satisfies InternalMessage);
}

async function relayFresh(message: Extract<InternalMessage, { type: 'fresh' }>): Promise<void> {
  if (message.origin === instanceId) return;
  const items = await unseenAndAllowed(message.items);
  if (items.length) post({ type: 'fresh', items, generatedAt: message.generatedAt, sources: message.sources });
}

function ensureChannel(): void {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<InternalMessage>) => {
      const message = event.data;
      if (!message || message.origin === instanceId) return;
      if (message.type === 'fresh') {
        void relayFresh(message);
        return;
      }
      if (message.type === 'poll-request') {
        if (status.leader) wakeLeader();
        return;
      }
      if (message.type === 'presence') {
        peerPresence.set(message.origin, { at: message.at, visible: message.visible, heartbeatAt: Date.now() });
      }
    };
    presenceTimer = self.setInterval(broadcastPresence, 30_000);
    broadcastPresence();
  }
  if (!rosterChannel && typeof BroadcastChannel !== 'undefined') {
    rosterChannel = new BroadcastChannel(FRONTIER_FORAGED_SOURCE_CHANNEL);
    rosterChannel.onmessage = () => {
      if (status.leader) wakeLeader();
      channel?.postMessage({ type: 'poll-request', origin: instanceId, reason: 'source-roster-changed' } satisfies InternalMessage);
    };
  }
}

function ensureLeadership(): void {
  if (leadershipController || stopped) return;
  ensureChannel();
  leadershipController = new AbortController();
  const signal = leadershipController.signal;
  const locks = (self.navigator as WorkerNavigator & { locks?: FrontierLockManagerLike }).locks;
  if (!locks) {
    publishStatus({ mode: 'single-worker-fallback' });
    void fallbackLoop(signal);
    return;
  }
  publishStatus({ leader: false, mode: 'web-lock' });
  void runFrontierDaemonLeadership(locks, signal, leaderLoop).catch((error) => {
    if (signal.aborted) return;
    post({ type: 'error', message: error instanceof Error ? error.message : 'daemon leadership failed' });
    void fallbackLoop(signal);
  });
}

async function replayCandidatePool(): Promise<void> {
  const items = await unseenAndAllowed(await readFrontierCandidates(96));
  if (items.length) post({ type: 'fresh', items, generatedAt: new Date().toISOString(), sources: [] });
}

function stop(): void {
  stopped = true;
  leadershipController?.abort();
  leadershipController = undefined;
  wakeLeader();
  if (presenceTimer !== undefined) self.clearInterval(presenceTimer);
  presenceTimer = undefined;
  channel?.close();
  channel = undefined;
  rosterChannel?.close();
  rosterChannel = undefined;
  unsubscribeSeen?.();
  unsubscribeSeen = undefined;
}

self.onmessage = (event: MessageEvent<FrontierDaemonRequest>) => {
  const request = event.data;
  if (!request) return;
  if (request.type === 'stop') {
    stop();
    return;
  }
  if (request.type === 'configure') {
    config = { ...request.config, excludeSignatures: request.config.excludeSignatures.slice(0, 256) };
    if (!configured) {
      configured = true;
      ensureLeadership();
      unsubscribeSeen = listenFrontierSeenSignatures((signatures) => {
        signatures.forEach((signature) => locallySeen.add(signature));
      });
      void replayCandidatePool();
    }
    broadcastPresence();
    return;
  }
  if (request.type === 'activity') {
    config = { ...config, lastActivityAt: request.at, visible: request.visible };
    broadcastPresence();
    return;
  }
  if (request.type === 'poll-now') {
    if (status.leader) wakeLeader();
    channel?.postMessage({ type: 'poll-request', origin: instanceId, reason: request.reason } satisfies InternalMessage);
  }
};

export {};
