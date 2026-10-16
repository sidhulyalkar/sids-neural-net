'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listFrontierAvoidAnchors,
  listenFrontierAvoidChanges,
  normalizeAvoidLabel,
  putFrontierAvoidAnchor,
  removeFrontierAvoidAnchor,
  setFrontierAvoidAnchorActive,
  type FrontierAvoidAnchor,
} from '@/lib/frontier/watch/avoidEngine';
import type { FrontierIntentEmbeddingBackend } from '@/lib/frontier/watch/intentEngine';
import { useVectorWorker, type FrontierVectorBackend } from '../vector/useVectorWorker';

const MIGRATION_BATCH = 24;

function intentBackend(value: FrontierVectorBackend): FrontierIntentEmbeddingBackend | undefined {
  return value === 'minilm' || value === 'feature-hash' ? value : undefined;
}

export function useAvoidIntentEngine() {
  const { embedDetailed, warm, backend } = useVectorWorker();
  const [anchors, setAnchors] = useState<FrontierAvoidAnchor[]>([]);
  const [loading, setLoading] = useState(true);
  const migrationRef = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const next = await listFrontierAvoidAnchors();
    setAnchors(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void refresh(); });
    const stop = listenFrontierAvoidChanges(() => void refresh());
    return () => {
      cancelled = true;
      stop();
    };
  }, [refresh]);

  useEffect(() => {
    if (!anchors.some((anchor) => anchor.active)) return;
    void warm();
  }, [anchors, warm]);

  const createAnchor = useCallback(async (raw: string): Promise<FrontierAvoidAnchor> => {
    const label = normalizeAvoidLabel(raw);
    if (!label) throw new Error('Avoid anchor cannot be empty');
    void warm();
    const embedded = await embedDetailed([{ id: '__avoid_anchor__', text: label }]);
    const vector = embedded.vectors.get('__avoid_anchor__');
    if (!vector) throw new Error('Could not encode Avoid anchor');
    const anchor = await putFrontierAvoidAnchor(label, vector, embedded.backend);
    await refresh();
    return anchor;
  }, [embedDetailed, refresh, warm]);

  const removeAnchor = useCallback(async (id: string) => {
    await removeFrontierAvoidAnchor(id);
    await refresh();
  }, [refresh]);

  const setAnchorActive = useCallback(async (id: string, active: boolean) => {
    await setFrontierAvoidAnchorActive(id, active);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const target = intentBackend(backend);
    const mismatched = target ? anchors.filter((anchor) => anchor.active && anchor.embeddingBackend !== target) : [];
    if (!target || !mismatched.length) return;
    migrationRef.current = migrationRef.current.then(async () => {
      for (let start = 0; start < mismatched.length; start += MIGRATION_BATCH) {
        const batch = mismatched.slice(start, start + MIGRATION_BATCH);
        const embedded = await embedDetailed(batch.map((anchor) => ({ id: anchor.id, text: anchor.label })));
        if (embedded.backend !== target) return;
        for (const anchor of batch) {
          const vector = embedded.vectors.get(anchor.id);
          if (vector) await putFrontierAvoidAnchor(anchor.label, vector, target, anchor.updatedAt);
        }
      }
      await refresh();
    }).catch(() => undefined);
  }, [anchors, backend, embedDetailed, refresh]);

  return {
    anchors,
    activeAnchors: anchors.filter((anchor) => anchor.active),
    loading,
    backend,
    createAnchor,
    removeAnchor,
    setAnchorActive,
  };
}
