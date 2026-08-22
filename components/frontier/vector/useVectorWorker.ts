'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type FrontierVectorBackend = 'idle' | 'loading' | 'minilm' | 'feature-hash' | 'unavailable';

type WorkerVector = { id: string; buffer: ArrayBuffer };
type WorkerResponse =
  | { type: 'embedded'; requestId: string; backend: 'minilm' | 'feature-hash'; vectors: WorkerVector[] }
  | { type: 'ready'; requestId: string; backend: 'minilm' | 'feature-hash' }
  | { type: 'error'; requestId: string; message: string };

type Pending = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useVectorWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, Pending>());
  const [backend, setBackend] = useState<FrontierVectorBackend>('idle');

  const failPending = useCallback((message: string) => {
    const error = new Error(message);
    for (const pending of pendingRef.current.values()) pending.reject(error);
    pendingRef.current.clear();
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(new URL('./vector.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const pending = pendingRef.current.get(response.requestId);
        if (!pending) return;
        pendingRef.current.delete(response.requestId);
        if (response.type === 'error') {
          pending.reject(new Error(response.message));
          return;
        }
        setBackend(response.backend);
        pending.resolve(response);
      };
      worker.onerror = () => {
        setBackend('unavailable');
        failPending('vector worker failed');
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };
      workerRef.current = worker;
      return worker;
    } catch {
      setBackend('unavailable');
      failPending('vector worker unavailable');
      return null;
    }
  }, [failPending]);

  const send = useCallback((payload: { type: 'warm' | 'embed'; items?: Array<{ id: string; text: string }> }) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('vector worker unavailable'));
    const id = requestId();
    return new Promise<WorkerResponse>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ ...payload, requestId: id });
    });
  }, [ensureWorker]);

  const warm = useCallback(async () => {
    if (backend === 'minilm' || backend === 'feature-hash' || backend === 'loading') return;
    setBackend('loading');
    try { await send({ type: 'warm' }); } catch { setBackend('unavailable'); }
  }, [backend, send]);

  const embed = useCallback(async (items: Array<{ id: string; text: string }>): Promise<Map<string, Float32Array>> => {
    if (!items.length) return new Map();
    setBackend((current) => current === 'idle' ? 'loading' : current);
    const response = await send({ type: 'embed', items: items.slice(0, 32) });
    if (response.type !== 'embedded') return new Map();
    return new Map(response.vectors.map((entry) => [entry.id, new Float32Array(entry.buffer)]));
  }, [send]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    failPending('vector worker unmounted');
  }, [failPending]);

  return { embed, warm, backend };
}
