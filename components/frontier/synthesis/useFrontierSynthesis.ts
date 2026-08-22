'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractFrontierArtifacts } from '@/lib/frontier/synthesis/artifactExtractor';
import { collapseFrontierConvergence } from '@/lib/frontier/synthesis/convergence';
import { recordAndScoreFrontierVelocity } from '@/lib/frontier/synthesis/velocityEngine';
import type { FrontierItem } from '@/lib/frontier/types';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';

function signature(items: FrontierItem[]): string {
  return items.slice(0, 96).map((item) => `${item.id}:${item.title}:${item.summary.length}`).join('|');
}

export function useFrontierSynthesis(
  items: FrontierItem[],
  options: { enabled?: boolean; vectorEpoch?: number } = {}
): FrontierItem[] {
  const enabled = options.enabled !== false;
  const vectorEpoch = options.vectorEpoch ?? 0;
  const itemSignature = useMemo(() => signature(items), [items]);
  const artifactEnriched = useMemo(() => items.map((item) => ({
    ...item,
    artifacts: item.artifacts?.length ? item.artifacts : extractFrontierArtifacts(item),
  })), [items]);
  const [synthesized, setSynthesized] = useState<FrontierItem[]>(artifactEnriched);

  useEffect(() => {
    if (!enabled || !artifactEnriched.length) {
      setSynthesized(artifactEnriched);
      return;
    }
    let cancelled = false;
    const run = async () => {
      let vectors = new Map<string, Float32Array>();
      try {
        vectors = await frontierVectorStore.getMany(artifactEnriched.slice(0, 96).map((item) => item.id));
      } catch {}
      if (cancelled) return;
      if (!vectors.size) {
        setSynthesized(artifactEnriched);
        return;
      }
      const velocity = await recordAndScoreFrontierVelocity(artifactEnriched, vectors).catch(() => new Map());
      if (cancelled) return;
      const withVelocity = artifactEnriched.map((item) => ({
        ...item,
        velocitySignal: velocity.get(item.id) ?? item.velocitySignal,
      }));
      setSynthesized(collapseFrontierConvergence(withVelocity, vectors));
    };
    void run();
    return () => { cancelled = true; };
  }, [artifactEnriched, enabled, itemSignature, vectorEpoch]);

  return enabled ? synthesized : artifactEnriched;
}
