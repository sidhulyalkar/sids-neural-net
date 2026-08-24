'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decodeDiscoveryFocus, encodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import type {
  FrontierDaemonRequest,
  FrontierDaemonResponse,
  FrontierDaemonStatus,
} from '@/lib/frontier/live/daemonProtocol';
import {
  filterUnseenFrontierItems,
  frontierItemIdentityKey,
  frontierSeenSignatures,
  listenFrontierSeenSignatures,
} from '@/lib/frontier/live/seenLedger';
import { publishFrontierRuntimeHealth } from '@/lib/frontier/runtime/runtimeHealth';
import { isFrontierSourceAdmitted } from '@/lib/frontier/sourceTrust';
import type { FrontierItem, FrontierSourceStatus } from '@/lib/frontier/types';
import { useFrontierAutonomy } from '../watch/FrontierAutonomyProvider';

const MAX_PENDING = 96;
const ACTIVITY_THROTTLE_MS = 4_000;

type PendingMeta = {
  generatedAt?: string;
  sources: FrontierSourceStatus[];
};

const EMPTY_STATUS: FrontierDaemonStatus = {
  leader: false,
  polling: false,
  consecutiveFailures: 0,
  consecutiveEmpty: 0,
  mode: 'web-lock',
};

export function useLiveDiscoveryDaemon(options: {
  focusSignature: string;
  excludeItems: FrontierItem[];
  prioritizeItems?: (items: FrontierItem[]) => Promise<FrontierItem[]>;
  onHighPriority?: (items: FrontierItem[], meta: { generatedAt?: string; sources: FrontierSourceStatus[] }) => void;
}) {
  const {
    activeWatchLabels,
    prioritizeItems: autonomyPrioritizeItems,
    announceHighPriority,
  } = useFrontierAutonomy();
  const {
    focusSignature,
    excludeItems,
    prioritizeItems,
    onHighPriority,
  } = options;
  const workerRef = useRef<Worker | null>(null);
  const exclusionRef = useRef(new Set<string>());
  const exclusionListRef = useRef<string[]>([]);
  const focusRef = useRef('');
  const prioritizeRef = useRef<(items: FrontierItem[]) => Promise<FrontierItem[]>>(autonomyPrioritizeItems);
  const highPriorityRef = useRef<(items: FrontierItem[], meta: { generatedAt?: string; sources: FrontierSourceStatus[] }) => void>(announceHighPriority);
  const pendingRef = useRef(new Map<string, FrontierItem>());
  const lastActivitySent = useRef(0);
  const retryTimer = useRef<number | undefined>(undefined);
  const failures = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<FrontierDaemonStatus>(EMPTY_STATUS);
  const [meta, setMeta] = useState<PendingMeta>({ sources: [] });
  const [workerGeneration, setWorkerGeneration] = useState(0);

  const combinedFocusSignature = useMemo(() => encodeDiscoveryFocus(Array.from(new Set([
    ...decodeDiscoveryFocus(focusSignature),
    ...activeWatchLabels,
  ])).slice(0, 10)), [activeWatchLabels, focusSignature]);

  const excludeSignatures = useMemo(() => Array.from(new Set(
    excludeItems.flatMap((item) => frontierSeenSignatures(item))
  )).slice(0, 256), [excludeItems]);

  const configureWorker = useCallback((worker: Worker) => {
    const request: FrontierDaemonRequest = {
      type: 'configure',
      config: {
        focusSignature: focusRef.current,
        visible: document.visibilityState === 'visible',
        lastActivityAt: Date.now(),
        excludeSignatures: exclusionListRef.current,
      },
    };
    worker.postMessage(request);
  }, []);

  useEffect(() => {
    exclusionRef.current = new Set(excludeSignatures);
    exclusionListRef.current = excludeSignatures;
    focusRef.current = combinedFocusSignature;
    prioritizeRef.current = prioritizeItems ?? autonomyPrioritizeItems;
    highPriorityRef.current = (items, pendingMeta) => {
      announceHighPriority(items, pendingMeta);
      onHighPriority?.(items, pendingMeta);
    };
    if (workerRef.current) configureWorker(workerRef.current);
  }, [
    announceHighPriority,
    autonomyPrioritizeItems,
    combinedFocusSignature,
    configureWorker,
    excludeSignatures,
    onHighPriority,
    prioritizeItems,
  ]);

  const prunePendingForSeen = useCallback((signatures: string[]) => {
    if (!signatures.length || !pendingRef.current.size) return;
    const seen = new Set(signatures);
    let changed = false;
    for (const [key, item] of pendingRef.current) {
      if (frontierSeenSignatures(item).some((signature) => seen.has(signature))) {
        pendingRef.current.delete(key);
        changed = true;
      }
    }
    if (changed) setPendingCount(pendingRef.current.size);
  }, []);

  const acceptFresh = useCallback(async (items: FrontierItem[], generatedAt?: string, sources: FrontierSourceStatus[] = []) => {
    // The server feed already applies destination-aware provenance vetting, but
    // the daemon can emit high-priority notifications before the normal page
    // ranking pass. Recheck admission here so stale/malformed worker payloads or
    // future transports cannot turn an unvetted publisher into an alert.
    let exact = (await filterUnseenFrontierItems(items)).filter((item) => isFrontierSourceAdmitted(item));
    if (prioritizeRef.current && exact.length) {
      try { exact = await prioritizeRef.current(exact); } catch { /* priority scoring is additive */ }
    }

    const allowed = exact.filter((item) => !frontierSeenSignatures(item).some((signature) => exclusionRef.current.has(signature)));
    const urgent = allowed.filter((item) => item.highPriority && item.watchSignal);
    const ambient = allowed.filter((item) => !item.highPriority || !item.watchSignal);

    if (urgent.length) {
      try { highPriorityRef.current(urgent, { generatedAt, sources }); } catch { /* audio/notification is additive */ }
    }

    let changed = false;
    for (const item of [...urgent, ...ambient]) {
      const key = frontierItemIdentityKey(item);
      if (!pendingRef.current.has(key)) {
        pendingRef.current.set(key, item);
        changed = true;
      }
    }
    if (pendingRef.current.size > MAX_PENDING) {
      const overflow = pendingRef.current.size - MAX_PENDING;
      const entries = Array.from(pendingRef.current.entries());
      const ambientKeys = entries.filter(([, item]) => !item.highPriority).map(([key]) => key);
      const priorityKeys = entries.filter(([, item]) => item.highPriority).map(([key]) => key);
      const remove = [...ambientKeys, ...priorityKeys].slice(0, overflow);
      remove.forEach((key) => pendingRef.current.delete(key));
      changed = true;
    }
    if (generatedAt || sources.length) setMeta({ generatedAt, sources });
    if (changed) setPendingCount(pendingRef.current.size);
  }, []);

  useEffect(() => {
    let worker: Worker;
    try {
      publishFrontierRuntimeHealth('live-daemon', 'starting');
      worker = new Worker(new URL('./liveDaemonWorker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      publishFrontierRuntimeHealth('live-daemon', 'failed', {
        message: error instanceof Error ? error.message : 'live daemon worker unavailable',
        consecutiveFailures: failures.current + 1,
      });
      return;
    }
    workerRef.current = worker;
    configureWorker(worker);

    worker.onmessage = (event: MessageEvent<FrontierDaemonResponse>) => {
      const response = event.data;
      if (!response) return;
      if (response.type === 'fresh') {
        void acceptFresh(response.items, response.generatedAt, response.sources);
        return;
      }
      if (response.type === 'status') {
        failures.current = response.status.consecutiveFailures;
        setStatus(response.status);
        publishFrontierRuntimeHealth(
          'live-daemon',
          response.status.consecutiveFailures > 0 ? 'degraded' : 'ready',
          {
            message: response.status.leader
              ? `leader · ${response.status.mode}`
              : `follower · ${response.status.mode}`,
            consecutiveFailures: response.status.consecutiveFailures,
          }
        );
        return;
      }
      failures.current += 1;
      publishFrontierRuntimeHealth('live-daemon', 'degraded', {
        message: response.message,
        consecutiveFailures: failures.current,
      });
    };

    worker.onerror = () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      failures.current += 1;
      publishFrontierRuntimeHealth('live-daemon', failures.current >= 3 ? 'failed' : 'degraded', {
        message: 'live discovery worker failed; restarting',
        consecutiveFailures: failures.current,
      });
      if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(
        () => setWorkerGeneration((generation) => generation + 1),
        Math.min(30_000, 1_000 * Math.pow(2, Math.min(4, failures.current - 1)))
      );
    };

    return () => {
      try { worker.postMessage({ type: 'stop' } satisfies FrontierDaemonRequest); } catch {}
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [acceptFresh, configureWorker, workerGeneration]);

  useEffect(() => listenFrontierSeenSignatures(prunePendingForSeen), [prunePendingForSeen]);

  useEffect(() => {
    const sendActivity = (force = false) => {
      const now = Date.now();
      if (!force && now - lastActivitySent.current < ACTIVITY_THROTTLE_MS) return;
      lastActivitySent.current = now;
      try {
        workerRef.current?.postMessage({
          type: 'activity',
          at: now,
          visible: document.visibilityState === 'visible',
        } satisfies FrontierDaemonRequest);
      } catch {}
    };
    const onVisibility = () => {
      sendActivity(true);
      if (document.visibilityState === 'visible') {
        try { workerRef.current?.postMessage({ type: 'poll-now', reason: 'visibility' } satisfies FrontierDaemonRequest); } catch {}
      }
    };
    const onActivity = () => sendActivity(false);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [workerGeneration]);

  useEffect(() => () => {
    if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
    publishFrontierRuntimeHealth('live-daemon', 'idle');
  }, []);

  const requestPoll = useCallback((reason: 'manual' | 'near-end' | 'visibility' = 'manual') => {
    try { workerRef.current?.postMessage({ type: 'poll-now', reason } satisfies FrontierDaemonRequest); } catch {}
  }, []);

  const flush = useCallback(async (limit = 24): Promise<FrontierItem[]> => {
    const snapshot = Array.from(pendingRef.current.values());
    const exact = (await filterUnseenFrontierItems(snapshot)).filter((item) => isFrontierSourceAdmitted(item));
    const allowed = exact.filter((item) => !frontierSeenSignatures(item).some((signature) => exclusionRef.current.has(signature)));
    const allowedKeys = new Set(allowed.map((item) => frontierItemIdentityKey(item)));
    for (const key of pendingRef.current.keys()) {
      if (!allowedKeys.has(key)) pendingRef.current.delete(key);
    }
    const prioritized = [
      ...allowed.filter((item) => item.highPriority && item.watchSignal),
      ...allowed.filter((item) => !item.highPriority || !item.watchSignal),
    ];
    const selected = prioritized.slice(0, Math.max(1, Math.min(MAX_PENDING, limit)));
    for (const item of selected) pendingRef.current.delete(frontierItemIdentityKey(item));
    if (snapshot.length !== pendingRef.current.size) setPendingCount(pendingRef.current.size);
    return selected;
  }, []);

  const clearPending = useCallback(() => {
    if (!pendingRef.current.size) return;
    pendingRef.current.clear();
    setPendingCount(0);
  }, []);

  return {
    pendingCount,
    status,
    generatedAt: meta.generatedAt,
    sources: meta.sources,
    requestPoll,
    flush,
    clearPending,
  };
}
