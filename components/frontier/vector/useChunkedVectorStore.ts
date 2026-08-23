'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  FRONTIER_WORKER_REQUEST_TIMEOUT_MS,
  publishFrontierRuntimeHealth,
} from '@/lib/frontier/runtime/runtimeHealth';
import type { FrontierChunkMetadata, FrontierChunkVector } from '@/lib/frontier/vector/chunkedVectorStore';

type WorkerVector = FrontierChunkMetadata & {
  id: string;
  buffer: ArrayBuffer;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
};

type WorkerResponse =
  | { type: 'ok'; requestId: string; count?: number; chunks?: number }
  | { type: 'vectors'; requestId: string; entries: WorkerVector[] }
  | { type: 'error'; requestId: string; message: string };

type Pending = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

function makeRequestId(): string {
  return `chunk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function decode(entries: WorkerVector[]): FrontierChunkVector[] {
  return entries.map((entry) => ({
    ...entry,
    vector: new Float32Array(entry.buffer),
  }));
}

export function useChunkedVectorStore() {
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
    publishFrontierRuntimeHealth('vector-archive', 'degraded', {
      message,
      consecutiveFailures: failuresRef.current,
    });
  }, [failPending]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    publishFrontierRuntimeHealth('vector-archive', 'starting');
    try {
      const worker = new Worker(new URL('./chunkedVectorStore.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const pending = pendingRef.current.get(response.requestId);
        if (!pending) return;
        pendingRef.current.delete(response.requestId);
        window.clearTimeout(pending.timeoutId);
        if (response.type === 'error') {
          pending.reject(new Error(response.message));
          publishFrontierRuntimeHealth('vector-archive', 'degraded', { message: response.message });
        } else {
          failuresRef.current = 0;
          pending.resolve(response);
          publishFrontierRuntimeHealth('vector-archive', 'ready');
        }
      };
      worker.onerror = () => failWorker(worker, 'chunked vector worker failed');
      worker.onmessageerror = () => failWorker(worker, 'chunked vector worker returned an unreadable message');
      workerRef.current = worker;
      return worker;
    } catch {
      failuresRef.current += 1;
      failPending('chunked vector worker unavailable');
      publishFrontierRuntimeHealth('vector-archive', 'failed', {
        message: 'chunked vector worker unavailable',
        consecutiveFailures: failuresRef.current,
      });
      return null;
    }
  }, [failPending, failWorker]);

  const send = useCallback((payload: Record<string, unknown>, transfers: Transferable[] = []) => {
    const worker = ensureWorker();
    if (!worker) return Promise.reject(new Error('chunked vector worker unavailable'));
    const requestId = makeRequestId();
    return new Promise<WorkerResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!pendingRef.current.has(requestId)) return;
        failWorker(worker, `chunked vector worker timed out after ${FRONTIER_WORKER_REQUEST_TIMEOUT_MS}ms`);
      }, FRONTIER_WORKER_REQUEST_TIMEOUT_MS);
      pendingRef.current.set(requestId, { resolve, reject, timeoutId });
      try {
        worker.postMessage({ ...payload, requestId }, transfers);
      } catch {
        failWorker(worker, 'chunked vector worker postMessage failed');
      }
    });
  }, [ensureWorker, failWorker]);

  const putMany = useCallback(async (entries: Array<{
    id: string;
    vector: Float32Array;
    textHash: string;
    metadata?: FrontierChunkMetadata;
    at?: number;
  }>) => {
    if (!entries.length) return;
    const transfers: Transferable[] = [];
    const payload = entries.slice(0, 48).map((entry) => {
      const copy = entry.vector.slice();
      const buffer = copy.buffer as ArrayBuffer;
      transfers.push(buffer);
      return { id: entry.id, buffer, textHash: entry.textHash, metadata: entry.metadata, at: entry.at };
    });
    await send({ type: 'putMany', entries: payload }, transfers);
  }, [send]);

  const getIds = useCallback(async (ids: string[]): Promise<FrontierChunkVector[]> => {
    if (!ids.length) return [];
    const response = await send({ type: 'getIds', ids: ids.slice(0, 256) });
    return response.type === 'vectors' ? decode(response.entries) : [];
  }, [send]);

  const neighborhood = useCallback(async (
    target: Float32Array,
    options: { maxChunks?: number; maxItems?: number } = {}
  ): Promise<FrontierChunkVector[]> => {
    const copy = target.slice();
    const buffer = copy.buffer as ArrayBuffer;
    const response = await send({
      type: 'neighborhood',
      target: buffer,
      maxChunks: options.maxChunks,
      maxItems: options.maxItems,
    }, [buffer]);
    return response.type === 'vectors' ? decode(response.entries) : [];
  }, [send]);

  const stats = useCallback(async () => {
    const response = await send({ type: 'stats' });
    return response.type === 'ok' ? { count: response.count ?? 0, chunks: response.chunks ?? 0 } : { count: 0, chunks: 0 };
  }, [send]);

  const clear = useCallback(async () => {
    await send({ type: 'clear' });
  }, [send]);

  useEffect(() => {
    const onClear = () => { void clear().catch(() => undefined); };
    window.addEventListener('frontier:clear-vector-archive', onClear);
    return () => window.removeEventListener('frontier:clear-vector-archive', onClear);
  }, [clear]);

  useEffect(() => () => {
    const worker = workerRef.current;
    workerRef.current = null;
    worker?.terminate();
    failPending('chunked vector worker unmounted');
    publishFrontierRuntimeHealth('vector-archive', 'idle');
  }, [failPending]);

  return { putMany, getIds, neighborhood, stats, clear };
}
