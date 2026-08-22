'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FRONTIER_WORKER_REQUEST_TIMEOUT_MS,
  publishFrontierRuntimeHealth,
} from '@/lib/frontier/runtime/runtimeHealth';
import { publishFrontierSignalLoad, resetFrontierSignalLoad } from '@/lib/frontier/signals/signalState';
import type { FrontierSignalFeatures } from '@/lib/frontier/signals/signalProcessing';

type WorkerResponse =
  | ({ type: 'features'; requestId: string } & FrontierSignalFeatures)
  | { type: 'error'; requestId: string; message: string };

type Pending = {
  resolve: (features: FrontierSignalFeatures) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

const EMPTY_FEATURES: FrontierSignalFeatures = {
  load: 0,
  mean: 0,
  standardDeviation: 0,
  derivativeRms: 0,
  sampleCount: 0,
};

function requestId(): string {
  return `signal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSignalProcessor() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, Pending>());
  const failuresRef = useRef(0);
  const [features, setFeatures] = useState<FrontierSignalFeatures>(EMPTY_FEATURES);

  const failPending = useCallback((message: string) => {
    const error = new Error(message);
    for (const pending of pendingRef.current.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    pendingRef.current.clear();
  }, []);

  const failWorker = useCallback((worker: Worker, message: string) => {
    if (workerRef.current !== worker) return;
    workerRef.current = null;
    worker.terminate();
    failuresRef.current += 1;
    failPending(message);
    resetFrontierSignalLoad();
    publishFrontierRuntimeHealth('signal-processor', 'degraded', {
      message,
      consecutiveFailures: failuresRef.current,
    });
  }, [failPending]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    publishFrontierRuntimeHealth('signal-processor', 'starting');
    try {
      const worker = new Worker(new URL('./signalProcessorWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const pending = pendingRef.current.get(response.requestId);
        if (!pending) return;
        pendingRef.current.delete(response.requestId);
        window.clearTimeout(pending.timeoutId);
        if (response.type === 'error') {
          pending.reject(new Error(response.message));
          publishFrontierRuntimeHealth('signal-processor', 'degraded', { message: response.message });
          return;
        }
        const next: FrontierSignalFeatures = {
          load: response.load,
          mean: response.mean,
          standardDeviation: response.standardDeviation,
          derivativeRms: response.derivativeRms,
          sampleCount: response.sampleCount,
        };
        failuresRef.current = 0;
        setFeatures(next);
        publishFrontierSignalLoad(next.load);
        publishFrontierRuntimeHealth('signal-processor', 'ready');
        pending.resolve(next);
      };
      worker.onerror = () => failWorker(worker, 'signal processor worker failed');
      worker.onmessageerror = () => failWorker(worker, 'signal processor worker returned an unreadable message');
      workerRef.current = worker;
      return worker;
    } catch {
      failuresRef.current += 1;
      failPending('signal processor worker unavailable');
      resetFrontierSignalLoad();
      publishFrontierRuntimeHealth('signal-processor', 'failed', {
        message: 'signal processor worker unavailable',
        consecutiveFailures: failuresRef.current,
      });
      return null;
    }
  }, [failPending, failWorker]);

  const send = useCallback((payload: Record<string, unknown>, transfers: Transferable[] = []) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('signal processor worker unavailable'));
    const id = requestId();
    return new Promise<FrontierSignalFeatures>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!pendingRef.current.has(id)) return;
        failWorker(worker, `signal processor worker timed out after ${FRONTIER_WORKER_REQUEST_TIMEOUT_MS}ms`);
      }, FRONTIER_WORKER_REQUEST_TIMEOUT_MS);
      pendingRef.current.set(id, { resolve, reject, timeoutId });
      try {
        worker.postMessage({ ...payload, requestId: id }, transfers);
      } catch {
        failWorker(worker, 'signal processor worker postMessage failed');
      }
    });
  }, [ensureWorker, failWorker]);

  const push = useCallback((values: ArrayLike<number>): Promise<FrontierSignalFeatures> => {
    if (!values.length) return Promise.resolve(EMPTY_FEATURES);
    const copy = Float32Array.from(values);
    const buffer = copy.buffer as ArrayBuffer;
    return send({ type: 'samples', values: buffer }, [buffer]);
  }, [send]);

  const reset = useCallback(async () => {
    resetFrontierSignalLoad();
    return send({ type: 'reset' });
  }, [send]);

  useEffect(() => () => {
    const worker = workerRef.current;
    workerRef.current = null;
    worker?.terminate();
    failPending('signal processor unmounted');
    resetFrontierSignalLoad();
    publishFrontierRuntimeHealth('signal-processor', 'idle');
  }, [failPending]);

  return { push, reset, features };
}
