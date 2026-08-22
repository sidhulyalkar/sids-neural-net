'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { rerankFrontierItems } from '@/lib/frontier/vector/ranker';
import {
  listenFrontierSemanticTelemetry,
  semanticTelemetryWeight,
} from '@/lib/frontier/vector/telemetryEngine';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';
import type { FrontierInterestState } from '@/lib/frontier/vector/math';
import { useVectorWorker } from './useVectorWorker';

const INDEX_BATCH = 12;
const ACTIVE_INDEX_LIMIT = 96;

function embeddingText(item: FrontierItem): string {
  return `${item.title}\n${item.summary}\n${item.tags.join(' · ')}`.slice(0, 3_500);
}

function textHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function idleTurn(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number };
  if (idleWindow.requestIdleCallback) {
    return new Promise((resolve) => idleWindow.requestIdleCallback?.(() => resolve(), { timeout: 350 }));
  }
  return new Promise((resolve) => window.setTimeout(resolve, 24));
}

export function useSemanticReranker(
  items: FrontierItem[],
  options: {
    query?: string;
    seedText?: string;
    enabled?: boolean;
  } = {}
) {
  const { embed, warm, backend } = useVectorWorker();
  const enabled = options.enabled !== false;
  const query = options.query ?? '';
  const seedText = options.seedText ?? '';
  const vectorsRef = useRef(new Map<string, Float32Array>());
  const telemetryQueue = useRef(Promise.resolve());
  const [vectorVersion, setVectorVersion] = useState(0);
  const [interest, setInterest] = useState<FrontierInterestState>();

  const itemSignature = useMemo(
    () => items.slice(0, ACTIVE_INDEX_LIMIT).map((item) => `${item.id}:${item.title}:${item.summary.length}`).join('|'),
    [items]
  );

  useEffect(() => {
    if (!enabled || !items.length) return;
    let cancelled = false;

    const index = async () => {
      await idleTurn();
      if (cancelled) return;
      void warm();
      const candidates = items.slice(0, ACTIVE_INDEX_LIMIT);
      let cached = new Map<string, Float32Array>();
      try { cached = await frontierVectorStore.getMany(candidates.map((item) => item.id)); } catch { /* private mode may disable IDB */ }
      if (cancelled) return;
      for (const [id, vector] of cached) vectorsRef.current.set(id, vector);
      if (cached.size) setVectorVersion((version) => version + 1);

      const missing = candidates.filter((item) => !vectorsRef.current.has(item.id));
      for (let start = 0; start < missing.length && !cancelled; start += INDEX_BATCH) {
        const batch = missing.slice(start, start + INDEX_BATCH);
        try {
          const embedded = await embed(batch.map((item) => ({ id: item.id, text: embeddingText(item) })));
          if (cancelled) return;
          const toStore: Array<{ id: string; vector: Float32Array; textHash: string }> = [];
          for (const item of batch) {
            const vector = embedded.get(item.id);
            if (!vector) continue;
            vectorsRef.current.set(item.id, vector);
            toStore.push({ id: item.id, vector, textHash: textHash(embeddingText(item)) });
          }
          if (toStore.length) {
            setVectorVersion((version) => version + 1);
            try { await frontierVectorStore.putMany(toStore); } catch { /* in-memory ranking still works */ }
          }
        } catch {
          break;
        }
        await idleTurn();
      }

      if (cancelled) return;
      try {
        let storedInterest = await frontierVectorStore.getInterest();
        if (!storedInterest && seedText.trim()) {
          const seedId = '__frontier_seed__';
          const embeddedSeed = await embed([{ id: seedId, text: seedText.slice(0, 3_500) }]);
          const seedVector = embeddedSeed.get(seedId);
          if (seedVector) {
            storedInterest = { vector: seedVector, mass: 0.65, updatedAt: Date.now() };
            await frontierVectorStore.setInterest(storedInterest);
          }
        }
        if (!cancelled && storedInterest) setInterest(storedInterest);
      } catch {
        // Ranking simply remains on the existing FRONTIER model if persistence is unavailable.
      }
    };

    void index();
    return () => { cancelled = true; };
  }, [embed, enabled, itemSignature, items, seedText, warm]);

  useEffect(() => {
    if (!enabled) return;
    return listenFrontierSemanticTelemetry((event) => {
      const signal = semanticTelemetryWeight(event);
      if (Math.abs(signal) < 0.001) return;
      telemetryQueue.current = telemetryQueue.current.then(async () => {
        let vector = vectorsRef.current.get(event.item.id);
        if (!vector) {
          try { vector = await frontierVectorStore.get(event.item.id); } catch { vector = undefined; }
        }
        if (!vector) {
          try {
            const embedded = await embed([{ id: event.item.id, text: embeddingText(event.item) }]);
            vector = embedded.get(event.item.id);
            if (vector) {
              vectorsRef.current.set(event.item.id, vector);
              try { await frontierVectorStore.put(event.item.id, vector, textHash(embeddingText(event.item))); } catch {}
              setVectorVersion((version) => version + 1);
            }
          } catch {
            return;
          }
        }
        if (!vector) return;
        try {
          const next = await frontierVectorStore.updateInterest(vector, signal, event.at);
          setInterest(next);
        } catch {
          // IndexedDB can be unavailable in strict private contexts. Existing
          // non-vector preference learning remains fully functional.
        }
      }).catch(() => undefined);
    });
  }, [embed, enabled]);

  const rankedItems = useMemo(() => {
    void vectorVersion;
    if (!enabled || !items.length) return items;
    const enoughVectors = vectorsRef.current.size >= Math.min(6, items.length);
    if (!enoughVectors && !query.trim()) return items;
    return rerankFrontierItems(
      items,
      vectorsRef.current,
      interest?.vector,
      query,
      0.15,
      Date.now(),
      `${new Date().toISOString().slice(0, 10)}:${query.toLowerCase()}`
    );
  }, [enabled, interest, items, query, vectorVersion]);

  return {
    items: rankedItems,
    backend,
    indexed: vectorsRef.current.size,
    interestReady: Boolean(interest),
  };
}
