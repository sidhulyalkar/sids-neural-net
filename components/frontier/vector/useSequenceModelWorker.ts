'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const failPending = useCallback((message: string) => {
    const error = new Error(message);
    for (const pending of pendingRef.current.values()) pending.reject(error);
    pendingRef.current.clear();
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(new URL('./sequenceModelWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const payload = event.data;
        const pending = pendingRef.current.get(payload.requestId);
        if (!pending) return;
        pendingRef.current.delete(payload.requestId);
        if (payload.type === 'error') pending.reject(new Error(payload.message));
        else pending.resolve(fromResponse(payload));
      };
      worker.onerror = () => {
        failPending('sequence worker failed');
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      workerRef.current = worker;
      return worker;
    } catch {
      failPending('sequence worker unavailable');
      return null;
    }
  }, [failPending]);

  const send = useCallback((payload: Record<string, unknown>, transfers: Transferable[] = []) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('sequence worker unavailable'));
    const id = requestId();
    return new Promise<FrontierSequenceState>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ ...payload, requestId: id }, transfers);
    });
  }, [ensureWorker]);

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
    workerRef.current?.terminate();
    workerRef.current = null;
    failPending('sequence worker unmounted');
  }, [failPending]);

  return useMemo(() => ({ hydrate, update, reset }), [hydrate, reset, update]);
}
