'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { listenFrontierSemanticTelemetry } from '@/lib/frontier/vector/telemetryEngine';
import type { FrontierItem, FrontierSourceStatus } from '@/lib/frontier/types';
import { FrontierCommandPalette } from '../FrontierCommandPalette';
import { useUIFrequencies } from '../audio/useUIFrequencies';
import { useSourceForager } from '../forage/useSourceForager';
import { useAvoidIntentEngine } from './useAvoidIntentEngine';
import { useWatchIntentEngine } from './useWatchIntentEngine';

export const FRONTIER_WATCH_PRIORITY_EVENT = 'frontier:watch-priority';

type FrontierAutonomyContextValue = {
  activeWatchLabels: string[];
  prioritizeItems: (items: FrontierItem[]) => Promise<FrontierItem[]>;
  announceHighPriority: (
    items: FrontierItem[],
    meta: { generatedAt?: string; sources: FrontierSourceStatus[] }
  ) => void;
};

const FrontierAutonomyContext = createContext<FrontierAutonomyContextValue>({
  activeWatchLabels: [],
  prioritizeItems: async (items) => items,
  announceHighPriority: () => undefined,
});

function identity(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return item.id;
  }
}

export function useFrontierAutonomy(): FrontierAutonomyContextValue {
  return useContext(FrontierAutonomyContext);
}

export function FrontierAutonomyProvider({ children }: { children: ReactNode }) {
  const watch = useWatchIntentEngine();
  const avoid = useAvoidIntentEngine();
  const { consider } = useSourceForager();
  const { playPrioritySignal } = useUIFrequencies();
  const announcedRef = useRef(new Set<string>());

  useEffect(() => listenFrontierSemanticTelemetry((event) => {
    if (event.kind === 'dwell' && (event.dwellMs ?? 0) >= 18_000) {
      void consider(event.item, Math.min(1.4, (event.dwellMs ?? 0) / 18_000));
      return;
    }
    if (event.kind === 'open') {
      void consider(event.item, 0.92);
      return;
    }
    if (event.kind === 'save') {
      void consider(event.item, 1.12);
      return;
    }
    if (event.kind === 'reaction' && event.reaction && ['up', 'love', 'important', 'surprise', 'useful'].includes(event.reaction)) {
      void consider(event.item, 1.25);
    }
  }), [consider]);

  const announceHighPriority = useCallback((
    items: FrontierItem[],
    meta: { generatedAt?: string; sources: FrontierSourceStatus[] }
  ) => {
    const fresh = items.filter((item) => {
      const key = identity(item);
      if (announcedRef.current.has(key)) return false;
      announcedRef.current.add(key);
      return true;
    });
    if (!fresh.length) return;
    if (announcedRef.current.size > 256) {
      const remove = announcedRef.current.size - 192;
      Array.from(announcedRef.current).slice(0, remove).forEach((key) => announcedRef.current.delete(key));
    }
    if (document.visibilityState === 'visible') playPrioritySignal();
    window.dispatchEvent(new CustomEvent(FRONTIER_WATCH_PRIORITY_EVENT, {
      detail: { items: fresh, ...meta },
    }));
  }, [playPrioritySignal]);

  const value = useMemo<FrontierAutonomyContextValue>(() => ({
    activeWatchLabels: watch.activeIntents.map((intent) => intent.label),
    prioritizeItems: watch.prioritizeItems,
    announceHighPriority,
  }), [announceHighPriority, watch.activeIntents, watch.prioritizeItems]);

  return (
    <FrontierAutonomyContext.Provider value={value}>
      {children}
      <FrontierCommandPalette
        intents={watch.intents}
        avoids={avoid.anchors}
        onCreate={watch.createIntent}
        onRemove={watch.removeIntent}
        onSetActive={watch.setIntentActive}
        onCreateAvoid={avoid.createAnchor}
        onRemoveAvoid={avoid.removeAnchor}
        onSetAvoidActive={avoid.setAnchorActive}
      />
    </FrontierAutonomyContext.Provider>
  );
}
