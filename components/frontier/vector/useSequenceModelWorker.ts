'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FRONTIER_WORKER_REQUEST_TIMEOUT_MS,
  publishFrontierRuntimeHealth,
} from '@/lib/frontier/runtime/runtimeHealth';
import type { FrontierSequenceState } from '@/lib/frontier/vector/sequenceModel';

type WorkerResponse =
  | {
      type: 'state';
      requestId: string;
      state: ArrayBuffer;
      target: ArrayBuffer;
      updatedAt: number;
      interactions: number;
    }
  | { type: 'error'; requestId: string; message: string };

type Pending = {
  resolve: (value: FrontierSequenceState) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function fromResponse(response: Extract<WorkerResponse, { type: 'state' }>): FrontierSequenceState {
  return {
    state: new Float32Array(response.state),
    target: new Float32Array(response.target),
    updatedAt: response.updatedAt,
    interactions: response.interactions,
  };
}

export function useSequenceModelWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, Pending>());
  const failuresRef = useRef(0);

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
    publishFrontierRuntimeHealth('sequence-model', 'degraded', {
      message,
      consecutiveFailures: failuresRef.current,
    });
  }, [failPending]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    publishFrontierRuntimeHealth('sequence-model', 'starting');
    try {
      const worker = new Worker(new URL('./sequenceModelWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const payload = event.data;
        const pending = pendingRef.current.get(payload.requestId);
        if (!pending) return;
        pendingRef.current.delete(payload.requestId);
        window.clearTimeout(pending.timeoutId);
        if (payload.type === 'error') {
          pending.reject(new Error(payload.message));
          publishFrontierRuntimeHealth('sequence-model', 'degraded', { message: payload.message });
        } else {
          failuresRef.current = 0;
          pending.resolve(fromResponse(payload));
          publishFrontierRuntimeHealth('sequence-model', 'ready');
        }
      };
      worker.onerror = () => failWorker(worker, 'sequence worker failed');
      worker.onmessageerror = () => failWorker(worker, 'sequence worker returned an unreadable message');
      workerRef.current = worker;
      return worker;
    } catch {
      failuresRef.current += 1;
      failPending('sequence worker unavailable');
      publishFrontierRuntimeHealth('sequence-model', 'failed', {
        message: 'sequence worker unavailable',
        consecutiveFailures: failuresRef.current,
      });
      return null;
    }
  }, [failPending, failWorker]);

  const send = useCallback((payload: Record<string, unknown>, transfers: Transferable[] = []) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('sequence worker unavailable'));
    const id = requestId();
    return new Promise<FrontierSequenceState>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!pendingRef.current.has(id)) return;
        failWorker(worker, `sequence worker timed out after ${FRONTIER_WORKER_REQUEST_TIMEOUT_MS}ms`);
      }, FRONTIER_WORKER_REQUEST_TIMEOUT_MS);
      pendingRef.current.set(id, { resolve, reject, timeoutId });
      try {
        worker.postMessage({ ...payload, requestId: id }, transfers);
      } catch {
        failWorker(worker, 'sequence worker postMessage failed');
      }
    });
  }, [ensureWorker, failWorker]);

  const hydrate = useCallback((state?: FrontierSequenceState) => {
    if (!state) return send({ type: 'hydrate' });
    const latent = state.state.slice();
    const target = state.target.slice();
    const latentBuffer = latent.buffer as ArrayBuffer;
    const targetBuffer = target.buffer as ArrayBuffer;
    return send({
      type: 'hydrate',
      state: latentBuffer,
      target: targetBuffer,
      updatedAt: state.updatedAt,
      interactions: state.interactions,
    }, [latentBuffer, targetBuffer]);
  }, [send]);

  const update = useCallback((vector: Float32Array, weight: number, at: number) => {
    const copy = vector.slice();
    const buffer = copy.buffer as ArrayBuffer;
    return send({ type: 'update', vector: buffer, weight, at }, [buffer]);
  }, [send]);

  const reset = useCallback(() => send({ type: 'reset' }), [send]);

  useEffect(() => () => {
    const worker = workerRef.current;
    workerRef.current = null;
    worker?.terminate();
    failPending('sequence worker unmounted');
    publishFrontierRuntimeHealth('sequence-model', 'idle');
  }, [failPending]);

  return useMemo(() => ({ hydrate, update, reset }), [hydrate, reset, update]);
}
