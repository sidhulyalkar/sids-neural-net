'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FRONTIER_MESH_PROFILE_UPDATE_EVENT } from '@/lib/frontier/sync/meshProfileEvents';
import type { FrontierItem } from '@/lib/frontier/types';
import { rerankFrontierAntiStaleness } from '@/lib/frontier/vector/antiStalenessReranker';
import { rerankFrontierItems } from '@/lib/frontier/vector/ranker';
import {
  listenFrontierSemanticTelemetry,
  semanticTelemetryWeight,
} from '@/lib/frontier/vector/telemetryEngine';
import { frontierVectorStore, type FrontierVectorMetadata } from '@/lib/frontier/vector/vectorStore';
import { normalizeVector, type FrontierInterestState } from '@/lib/frontier/vector/math';
import { neighborhoodCentroid } from '@/lib/frontier/vector/chunkedVectorStore';
import {
  blendSequenceWithLongTerm,
  type FrontierSequenceState,
} from '@/lib/frontier/vector/sequenceModel';
import { frontierSignalLoadSnapshot } from '@/lib/frontier/signals/signalState';
import { modulateImplicitSignalWeight } from '@/lib/frontier/signals/signalProcessing';
import { useChunkedVectorStore } from './useChunkedVectorStore';
import { useSequenceModelWorker } from './useSequenceModelWorker';
import { useVectorWorker } from './useVectorWorker';

const INDEX_BATCH = 12;
const ACTIVE_INDEX_LIMIT = 96;
const RESIDENT_VECTOR_LIMIT = 320;

function embeddingText(item: FrontierItem): string {
  return `${item.title}\n${item.summary}\n${item.tags.join(' · ')}`.slice(0, 3_500);
}

function metadata(item: FrontierItem): FrontierVectorMetadata {
  return {
    title: item.title,
    sourceLabel: item.sourceLabel,
    lane: item.lane,
    publishedAt: item.publishedAt,
  };
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

function trimResidentVectors(vectors: Map<string, Float32Array>, protectedIds: Set<string>): void {
  if (vectors.size <= RESIDENT_VECTOR_LIMIT) return;
  for (const id of vectors.keys()) {
    if (vectors.size <= RESIDENT_VECTOR_LIMIT) break;
    if (!protectedIds.has(id)) vectors.delete(id);
  }
}

function blendMemoryTarget(primary: Float32Array | undefined, memory: Float32Array | undefined): Float32Array | undefined {
  if (!primary?.length) return memory;
  if (!memory?.length || memory.length !== primary.length) return primary;
  const output = new Float32Array(primary.length);
  for (let index = 0; index < output.length; index += 1) output[index] = primary[index] * 0.86 + memory[index] * 0.14;
  return normalizeVector(output);
}

export function useSemanticReranker(
  items: FrontierItem[],
  options: {
    query?: string;
    seedText?: string;
    enabled?: boolean;
    explorationTemperature?: number;
    diversityReference?: FrontierItem[];
  } = {}
) {
  const { embed, warm, backend } = useVectorWorker();
  const sequenceWorker = useSequenceModelWorker();
  const {
    putMany: archivePutMany,
    getIds: archiveGetIds,
    neighborhood: archiveNeighborhood,
  } = useChunkedVectorStore();
  const enabled = options.enabled !== false;
  const query = options.query ?? '';
  const seedText = options.seedText ?? '';
  const explorationTemperature = Math.max(0, Math.min(1, options.explorationTemperature ?? 0));
  const diversityReference = options.diversityReference ?? [];
  const vectorsRef = useRef(new Map<string, Float32Array>());
  const telemetryQueue = useRef(Promise.resolve());
  const sequenceHydrationRef = useRef<Promise<FrontierSequenceState | undefined> | undefined>(undefined);
  const [vectorVersion, setVectorVersion] = useState(0);
  const [interest, setInterest] = useState<FrontierInterestState>();
  const [sequence, setSequence] = useState<FrontierSequenceState>();
  const [memoryCentroid, setMemoryCentroid] = useState<Float32Array>();

  const ensureSequenceHydrated = useCallback(() => {
    if (!sequenceHydrationRef.current) {
      sequenceHydrationRef.current = (async () => {
        let stored: FrontierSequenceState | undefined;
        try { stored = await frontierVectorStore.getSequence(); } catch { stored = undefined; }
        try {
          const hydrated = await sequenceWorker.hydrate(stored);
          setSequence(hydrated);
          return hydrated;
        } catch {
          return stored;
        }
      })();
    }
    return sequenceHydrationRef.current;
  }, [sequenceWorker]);

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
      const protectedIds = new Set(candidates.map((item) => item.id));
      let cached = new Map<string, Float32Array>();
      try { cached = await frontierVectorStore.getMany(candidates.map((item) => item.id)); } catch { /* private mode may disable IDB */ }
      if (cancelled) return;
      for (const [id, vector] of cached) vectorsRef.current.set(id, vector);

      let missing = candidates.filter((item) => !vectorsRef.current.has(item.id));
      if (missing.length) {
        try {
          const archived = await archiveGetIds(missing.map((item) => item.id));
          if (cancelled) return;
          const byId = new Map(candidates.map((item) => [item.id, item]));
          const promote: Array<{ id: string; vector: Float32Array; textHash: string; metadata: FrontierVectorMetadata }> = [];
          for (const entry of archived) {
            vectorsRef.current.set(entry.id, entry.vector);
            const item = byId.get(entry.id);
            promote.push({
              id: entry.id,
              vector: entry.vector,
              textHash: entry.textHash,
              metadata: item ? metadata(item) : {
                title: entry.title,
                sourceLabel: entry.sourceLabel,
                lane: entry.lane,
                publishedAt: entry.publishedAt,
                engagement: entry.engagement,
                lastSignalAt: entry.lastSignalAt,
              },
            });
          }
          if (promote.length) void frontierVectorStore.putMany(promote).catch(() => undefined);
        } catch {
          // Cold archive is opportunistic; active content can always be re-embedded.
        }
      }

      missing = candidates.filter((item) => !vectorsRef.current.has(item.id));
      for (let start = 0; start < missing.length && !cancelled; start += INDEX_BATCH) {
        const batch = missing.slice(start, start + INDEX_BATCH);
        try {
          const embedded = await embed(batch.map((item) => ({ id: item.id, text: embeddingText(item) })));
          if (cancelled) return;
          const toStore: Array<{ id: string; vector: Float32Array; textHash: string; metadata: FrontierVectorMetadata }> = [];
          for (const item of batch) {
            const vector = embedded.get(item.id);
            if (!vector) continue;
            vectorsRef.current.set(item.id, vector);
            toStore.push({ id: item.id, vector, textHash: textHash(embeddingText(item)), metadata: metadata(item) });
          }
          if (toStore.length) {
            try { await frontierVectorStore.putMany(toStore); } catch { /* in-memory ranking still works */ }
            void archivePutMany(toStore).catch(() => undefined);
          }
        } catch {
          break;
        }
        await idleTurn();
      }

      trimResidentVectors(vectorsRef.current, protectedIds);
      if (cached.size || candidates.some((item) => vectorsRef.current.has(item.id))) setVectorVersion((version) => version + 1);

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

      if (!cancelled) void ensureSequenceHydrated();
    };

    void index();
    return () => { cancelled = true; };
  }, [archiveGetIds, archivePutMany, embed, enabled, ensureSequenceHydrated, itemSignature, items, seedText, warm]);

  useEffect(() => {
    if (!enabled) return;
    const refreshFromMesh = () => {
      telemetryQueue.current = telemetryQueue.current.then(async () => {
        let nextInterest: FrontierInterestState | undefined;
        let nextSequence: FrontierSequenceState | undefined;
        try { nextInterest = await frontierVectorStore.getInterest(); } catch {}
        try { nextSequence = await frontierVectorStore.getSequence(); } catch {}
        if (nextInterest) setInterest(nextInterest);
        if (nextSequence) {
          const hydration = sequenceWorker.hydrate(nextSequence)
            .then((hydrated) => {
              setSequence(hydrated);
              return hydrated;
            })
            .catch(() => {
              setSequence(nextSequence);
              return nextSequence;
            });
          sequenceHydrationRef.current = hydration;
          await hydration;
        }
      }).catch(() => undefined);
    };
    window.addEventListener(FRONTIER_MESH_PROFILE_UPDATE_EVENT, refreshFromMesh);
    return () => window.removeEventListener(FRONTIER_MESH_PROFILE_UPDATE_EVENT, refreshFromMesh);
  }, [enabled, sequenceWorker]);

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
            const archived = await archiveGetIds([event.item.id]);
            vector = archived[0]?.vector;
            if (vector) vectorsRef.current.set(event.item.id, vector);
          } catch {}
        }
        if (!vector) {
          try {
            const embedded = await embed([{ id: event.item.id, text: embeddingText(event.item) }]);
            vector = embedded.get(event.item.id);
            if (vector) {
              vectorsRef.current.set(event.item.id, vector);
              const record = {
                id: event.item.id,
                vector,
                textHash: textHash(embeddingText(event.item)),
                metadata: metadata(event.item),
                at: event.at,
              };
              try { await frontierVectorStore.put(record.id, record.vector, record.textHash, event.at, record.metadata); } catch {}
              void archivePutMany([record]).catch(() => undefined);
              setVectorVersion((version) => version + 1);
            }
          } catch {
            return;
          }
        }
        if (!vector) return;

        // Long-term taste keeps the full interaction evidence. Physiological
        // load only tempers positive implicit momentum in the fast context SSM.
        try {
          const nextInterest = await frontierVectorStore.updateInterest(vector, signal, event.at);
          setInterest(nextInterest);
        } catch {}

        try { await frontierVectorStore.recordEngagement(event.item.id, signal, event.at); } catch {}
        void archivePutMany([{
          id: event.item.id,
          vector,
          textHash: textHash(embeddingText(event.item)),
          metadata: { ...metadata(event.item), engagement: signal, lastSignalAt: event.at },
          at: event.at,
        }]).catch(() => undefined);

        const explicit = event.kind === 'reaction' || event.kind === 'save';
        const sequenceSignal = modulateImplicitSignalWeight(signal, frontierSignalLoadSnapshot(event.at), explicit);
        try {
          await ensureSequenceHydrated();
          const nextSequence = await sequenceWorker.update(vector, sequenceSignal, event.at);
          setSequence(nextSequence);
          try { await frontierVectorStore.setSequence(nextSequence); } catch {}
        } catch {
          // Sequence momentum is additive. Long-term semantic ranking remains
          // available if a browser blocks workers or IndexedDB.
        }
      }).catch(() => undefined);
    });
  }, [archiveGetIds, archivePutMany, embed, enabled, ensureSequenceHydrated, sequenceWorker]);

  const sequenceTarget = useMemo(
    () => blendSequenceWithLongTerm(sequence?.target, interest?.vector, sequence?.interactions ?? 0),
    [interest, sequence]
  );

  useEffect(() => {
    if (!enabled || !sequenceTarget?.length) {
      setMemoryCentroid(undefined);
      return;
    }
    let cancelled = false;
    void archiveNeighborhood(sequenceTarget, { maxChunks: 6, maxItems: 144 })
      .then((entries) => {
        if (cancelled) return;
        setMemoryCentroid(neighborhoodCentroid(entries, sequenceTarget));
        for (const entry of entries) vectorsRef.current.set(entry.id, entry.vector);
        trimResidentVectors(vectorsRef.current, new Set(items.slice(0, ACTIVE_INDEX_LIMIT).map((item) => item.id)));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [archiveNeighborhood, enabled, items, sequenceTarget]);

  const rankingTarget = useMemo(
    () => blendMemoryTarget(sequenceTarget, memoryCentroid),
    [memoryCentroid, sequenceTarget]
  );

  const rankedItems = useMemo(() => {
    void vectorVersion;
    if (!enabled || !items.length) return items;
    const enoughVectors = vectorsRef.current.size >= Math.min(6, items.length);
    if (!enoughVectors && !query.trim()) return items;
    if (explorationTemperature > 0.001) {
      return rerankFrontierAntiStaleness(
        items,
        vectorsRef.current,
        rankingTarget,
        sequence?.state,
        query,
        diversityReference,
        explorationTemperature,
        Date.now()
      );
    }
    return rerankFrontierItems(
      items,
      vectorsRef.current,
      rankingTarget,
      query,
      0.15,
      Date.now(),
      `${new Date().toISOString().slice(0, 10)}:${query.toLowerCase()}`
    );
  }, [diversityReference, enabled, explorationTemperature, items, query, rankingTarget, sequence?.state, vectorVersion]);

  return {
    items: rankedItems,
    backend,
    indexed: vectorsRef.current.size,
    interestReady: Boolean(interest),
    sequenceReady: Boolean(sequence?.interactions),
    sequenceInteractions: sequence?.interactions ?? 0,
    outOfCoreReady: Boolean(memoryCentroid),
  };
}
