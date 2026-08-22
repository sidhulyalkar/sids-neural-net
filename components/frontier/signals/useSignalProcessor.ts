'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { publishFrontierSignalLoad, resetFrontierSignalLoad } from '@/lib/frontier/signals/signalState';
import type { FrontierSignalFeatures } from '@/lib/frontier/signals/signalProcessing';

type WorkerResponse =
  | ({ type: 'features'; requestId: string } & FrontierSignalFeatures)
  | { type: 'error'; requestId: string; message: string };

type Pending = {
  resolve: (features: FrontierSignalFeatures) => void;
  reject: (error: Error) => void;
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
  const [features, setFeatures] = useState<FrontierSignalFeatures>(EMPTY_FEATURES);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('./signalProcessorWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = pendingRef.current.get(response.requestId);
      if (!pending) return;
      pendingRef.current.delete(response.requestId);
      if (response.type === 'error') {
        pending.reject(new Error(response.message));
        return;
      }
      const next: FrontierSignalFeatures = {
        load: response.load,
        mean: response.mean,
        standardDeviation: response.standardDeviation,
        derivativeRms: response.derivativeRms,
        sampleCount: response.sampleCount,
      };
      setFeatures(next);
      publishFrontierSignalLoad(next.load);
      pending.resolve(next);
    };
    worker.onerror = () => {
      const error = new Error('signal processor worker failed');
      for (const pending of pendingRef.current.values()) pending.reject(error);
      pendingRef.current.clear();
      worker.terminate();
      workerRef.current = null;
      resetFrontierSignalLoad();
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const push = useCallback((values: ArrayLike<number>): Promise<FrontierSignalFeatures> => {
    if (!values.length) return Promise.resolve(EMPTY_FEATURES);
    const worker = ensureWorker();
    const copy = Float32Array.from(values);
    const buffer = copy.buffer as ArrayBuffer;
    const id = requestId();
    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ type: 'samples', requestId: id, values: buffer }, [buffer]);
    });
  }, [ensureWorker]);

  const reset = useCallback(() => {
    const worker = ensureWorker();
    const id = requestId();
    resetFrontierSignalLoad();
    return new Promise<FrontierSignalFeatures>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ type: 'reset', requestId: id });
    });
  }, [ensureWorker]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    const error = new Error('signal processor unmounted');
    for (const pending of pendingRef.current.values()) pending.reject(error);
    pendingRef.current.clear();
    resetFrontierSignalLoad();
  }, []);

  return { push, reset, features };
}
