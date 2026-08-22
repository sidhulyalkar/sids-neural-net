'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bestFrontierWatchMatch,
  FRONTIER_WATCH_NOVELTY_MIN,
  FRONTIER_WATCH_QUALITY_MIN,
  listFrontierWatchIntents,
  listenFrontierWatchIntentChanges,
  normalizeWatchIntentLabel,
  putFrontierWatchIntent,
  removeFrontierWatchIntent,
  setFrontierWatchIntentActive,
  type FrontierIntentEmbeddingBackend,
  type FrontierWatchIntent,
} from '@/lib/frontier/watch/intentEngine';
import type { FrontierItem } from '@/lib/frontier/types';
import { useVectorWorker, type FrontierEmbeddingBackend } from '../vector/useVectorWorker';

const WATCH_BATCH = 24;
const VECTOR_CACHE_LIMIT = 320;

type CachedVector = {
  fingerprint: string;
  backend: FrontierEmbeddingBackend;
  vector: Float32Array;
};

function embeddingText(item: FrontierItem): string {
  return `${item.title}\n${item.summary}\n${item.tags.join(' · ')}\n${(item.authors ?? []).join(' · ')}`.slice(0, 3_500);
}

function fingerprint(item: FrontierItem): string {
  return `${item.id}:${item.title}:${item.summary.length}:${item.publishedAt}`;
}

function stripWatchSignal(item: FrontierItem): FrontierItem {
  if (!item.highPriority && !item.watchSignal) return item;
  const { highPriority: _highPriority, watchSignal: _watchSignal, ...rest } = item;
  return rest;
}

export function useWatchIntentEngine() {
  const { embedDetailed, warm, backend } = useVectorWorker();
  const [intents, setIntents] = useState<FrontierWatchIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef(new Map<string, CachedVector>());
  const migrationRef = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const next = await listFrontierWatchIntents();
    setIntents(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return listenFrontierWatchIntentChanges(() => void refresh());
  }, [refresh]);

  const createIntent = useCallback(async (raw: string): Promise<FrontierWatchIntent> => {
    const label = normalizeWatchIntentLabel(raw);
    if (!label) throw new Error('Watch intent cannot be empty');
    void warm();
    const embedded = await embedDetailed([{ id: '__watch_intent__', text: label }]);
    const vector = embedded.vectors.get('__watch_intent__');
    if (!vector) throw new Error('Could not encode Watch Intent');
    const intent = await putFrontierWatchIntent(label, vector, embedded.backend);
    await refresh();
    return intent;
  }, [embedDetailed, refresh, warm]);

  const removeIntent = useCallback(async (id: string) => {
    await removeFrontierWatchIntent(id);
    await refresh();
  }, [refresh]);

  const setIntentActive = useCallback(async (id: string, active: boolean) => {
    await setFrontierWatchIntentActive(id, active);
    await refresh();
  }, [refresh]);

  const migrateBackend = useCallback(async (
    source: FrontierWatchIntent[],
    targetBackend: FrontierEmbeddingBackend
  ): Promise<FrontierWatchIntent[]> => {
    const compatible = source.filter((intent) => intent.embeddingBackend === targetBackend);
    const mismatched = source.filter((intent) => intent.active && intent.embeddingBackend !== targetBackend);
    if (!mismatched.length) return compatible;

    const migrated: FrontierWatchIntent[] = [...compatible];
    for (let start = 0; start < mismatched.length; start += WATCH_BATCH) {
      const batch = mismatched.slice(start, start + WATCH_BATCH);
      const embedded = await embedDetailed(batch.map((intent) => ({ id: intent.id, text: intent.label })));
      if (embedded.backend !== targetBackend) continue;
      for (const intent of batch) {
        const vector = embedded.vectors.get(intent.id);
        if (!vector) continue;
        const next = await putFrontierWatchIntent(intent.label, vector, targetBackend, intent.updatedAt);
        migrated.push(next);
      }
    }
    return migrated;
  }, [embedDetailed]);

  const prioritizeItems = useCallback(async (items: FrontierItem[]): Promise<FrontierItem[]> => {
    const active = intents.filter((intent) => intent.active);
    if (!items.length) return items;
    if (!active.length) return items.map(stripWatchSignal);

    const eligible = items.filter((item) => item.novelty >= FRONTIER_WATCH_NOVELTY_MIN && item.quality >= FRONTIER_WATCH_QUALITY_MIN);
    if (!eligible.length) return items.map(stripWatchSignal);

    const vectors = new Map<string, { backend: FrontierEmbeddingBackend; vector: Float32Array }>();
    let scoringBackend: FrontierEmbeddingBackend | undefined;

    for (let start = 0; start < eligible.length; start += WATCH_BATCH) {
      const batch = eligible.slice(start, start + WATCH_BATCH);
      const missing = batch.filter((item) => {
        const cached = cacheRef.current.get(item.id);
        return !cached || cached.fingerprint !== fingerprint(item);
      });

      let embedded: Awaited<ReturnType<typeof embedDetailed>> | undefined;
      if (missing.length) {
        embedded = await embedDetailed(missing.map((item) => ({ id: item.id, text: embeddingText(item) })));
        scoringBackend = scoringBackend ?? embedded.backend;
        for (const item of missing) {
          const vector = embedded.vectors.get(item.id);
          if (!vector) continue;
          cacheRef.current.set(item.id, { fingerprint: fingerprint(item), backend: embedded.backend, vector });
        }
      }

      for (const item of batch) {
        const cached = cacheRef.current.get(item.id);
        if (!cached) continue;
        scoringBackend = scoringBackend ?? cached.backend;
        if (cached.backend === scoringBackend) vectors.set(item.id, { backend: cached.backend, vector: cached.vector });
      }
    }

    if (!scoringBackend) return items.map(stripWatchSignal);
    let compatible = active.filter((intent) => intent.embeddingBackend === scoringBackend);
    if (compatible.length !== active.length) {
      migrationRef.current = migrationRef.current.then(async () => {
        compatible = await migrateBackend(active, scoringBackend!);
      }).catch(() => undefined);
      await migrationRef.current;
    }
    if (!compatible.length) return items.map(stripWatchSignal);

    if (cacheRef.current.size > VECTOR_CACHE_LIMIT) {
      const remove = cacheRef.current.size - VECTOR_CACHE_LIMIT;
      Array.from(cacheRef.current.keys()).slice(0, remove).forEach((key) => cacheRef.current.delete(key));
    }

    const now = Date.now();
    return items.map((item) => {
      const entry = vectors.get(item.id);
      if (!entry || entry.backend !== scoringBackend) return stripWatchSignal(item);
      const match = bestFrontierWatchMatch(item, entry.vector, compatible);
      if (!match || !match.highPriority) return stripWatchSignal(item);
      return {
        ...item,
        highPriority: true,
        watchSignal: {
          intentId: match.intentId,
          label: match.label,
          score: match.score,
          triggeredAt: now,
        },
      };
    });
  }, [intents, migrateBackend]);

  return {
    intents,
    activeIntents: intents.filter((intent) => intent.active),
    loading,
    backend,
    createIntent,
    removeIntent,
    setIntentActive,
    prioritizeItems,
  };
}
