'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractFrontierArtifacts } from '@/lib/frontier/synthesis/artifactExtractor';
import { collapseFrontierConvergence } from '@/lib/frontier/synthesis/convergence';
import {
  frontierSynthesisInputSignature,
  frontierSynthesisPresentationItems,
  type FrontierSynthesisSnapshot,
} from '@/lib/frontier/synthesis/presentationState';
import { recordAndScoreFrontierVelocity } from '@/lib/frontier/synthesis/velocityEngine';
import type { FrontierItem } from '@/lib/frontier/types';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';

export function useFrontierSynthesis(
  items: FrontierItem[],
  options: { enabled?: boolean; vectorEpoch?: number } = {}
): FrontierItem[] {
  const enabled = options.enabled !== false;
  const vectorEpoch = options.vectorEpoch ?? 0;
  const itemSignature = useMemo(() => frontierSynthesisInputSignature(items), [items]);
  const artifactEnriched = useMemo(() => items.map((item) => ({
    ...item,
    artifacts: item.artifacts?.length ? item.artifacts : extractFrontierArtifacts(item),
  })), [items]);
  const [synthesized, setSynthesized] = useState<FrontierSynthesisSnapshot>(() => ({
    inputSignature: itemSignature,
    items: artifactEnriched,
  }));

  useEffect(() => {
    if (!enabled || !artifactEnriched.length) {
      setSynthesized({ inputSignature: itemSignature, items: artifactEnriched });
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
        setSynthesized({ inputSignature: itemSignature, items: artifactEnriched });
        return;
      }
      const velocity = await recordAndScoreFrontierVelocity(artifactEnriched, vectors).catch(() => new Map());
      if (cancelled) return;
      const withVelocity = artifactEnriched.map((item) => ({
        ...item,
        velocitySignal: velocity.get(item.id) ?? item.velocitySignal,
      }));
      setSynthesized({
        inputSignature: itemSignature,
        items: collapseFrontierConvergence(withVelocity, vectors),
      });
    };
    void run();
    return () => { cancelled = true; };
  }, [artifactEnriched, enabled, itemSignature, vectorEpoch]);

  return frontierSynthesisPresentationItems(
    artifactEnriched,
    itemSignature,
    synthesized,
    enabled,
  );
}
