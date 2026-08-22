'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';
import type { FrontierSequenceState } from '@/lib/frontier/vector/sequenceModel';
import {
  FrontierMeshPeer,
  createFrontierMeshState,
  deserializeSequenceState,
  mergeFrontierMeshState,
  withEngagementDelta,
  withSequenceState,
  type FrontierMeshState,
  type FrontierMeshStatus,
} from '@/lib/frontier/sync/meshSync';

const ACTOR_KEY = 'frontier-mesh-actor-v1';
const STATE_KEY = 'frontier-mesh-state-v1';

function randomActorId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `peer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadActorId(): string {
  try {
    const existing = localStorage.getItem(ACTOR_KEY);
    if (existing) return existing;
    const created = randomActorId();
    localStorage.setItem(ACTOR_KEY, created);
    return created;
  } catch {
    return randomActorId();
  }
}

function loadMeshState(actorId: string): FrontierMeshState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createFrontierMeshState(actorId);
    const parsed = JSON.parse(raw) as FrontierMeshState;
    if (parsed.version !== 1) return createFrontierMeshState(actorId);
    return { ...parsed, actorId };
  } catch {
    return createFrontierMeshState(actorId);
  }
}

function persistMeshState(state: FrontierMeshState): void {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
}

/**
 * Pairing is intentionally manual/local-first: create an offer on one device,
 * paste it into the second device, then paste the answer back. No signaling
 * server or cloud account is required. Callers may provide STUN/TURN servers if
 * they deliberately want internet traversal; the default uses local candidates.
 */
export function useFrontierMeshSync() {
  const peerRef = useRef<FrontierMeshPeer | null>(null);
  const [status, setStatus] = useState<FrontierMeshStatus>('offline');
  const [state, setState] = useState<FrontierMeshState>();

  useEffect(() => {
    const actorId = loadActorId();
    let initial = loadMeshState(actorId);
    let cancelled = false;
    void frontierVectorStore.getSequence().then((sequence) => {
      if (cancelled) return;
      if (sequence && !initial.sequence) initial = withSequenceState(initial, sequence);
      setState(initial);
      persistMeshState(initial);
    }).catch(() => {
      if (!cancelled) setState(initial);
    });
    return () => {
      cancelled = true;
      peerRef.current?.close();
      peerRef.current = null;
    };
  }, []);

  const applyState = useCallback((next: FrontierMeshState) => {
    setState((current) => {
      const merged = current ? mergeFrontierMeshState(current, next) : next;
      persistMeshState(merged);
      if (merged.sequence) {
        const sequence = deserializeSequenceState(merged.sequence.value);
        void frontierVectorStore.setSequence(sequence).catch(() => undefined);
      }
      return merged;
    });
  }, []);

  const ensurePeer = useCallback(() => {
    if (peerRef.current) return peerRef.current;
    const current = state ?? createFrontierMeshState(loadActorId());
    const peer = new FrontierMeshPeer({
      actorId: current.actorId,
      initialState: current,
      onState: applyState,
      onStatus: setStatus,
    });
    peerRef.current = peer;
    return peer;
  }, [applyState, state]);

  const publishSequence = useCallback((sequence: FrontierSequenceState) => {
    setState((current) => {
      if (!current) return current;
      const next = withSequenceState(current, sequence);
      persistMeshState(next);
      peerRef.current?.updateState(next);
      return next;
    });
  }, []);

  const publishEngagement = useCallback((itemId: string, delta: number) => {
    setState((current) => {
      if (!current) return current;
      const next = withEngagementDelta(current, itemId, delta);
      persistMeshState(next);
      peerRef.current?.updateState(next);
      return next;
    });
  }, []);

  const createOffer = useCallback(() => ensurePeer().createOffer(), [ensurePeer]);
  const acceptOffer = useCallback((offer: string) => ensurePeer().acceptOffer(offer), [ensurePeer]);
  const acceptAnswer = useCallback((answer: string) => ensurePeer().acceptAnswer(answer), [ensurePeer]);
  const close = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setStatus('offline');
  }, []);

  return {
    state,
    status,
    createOffer,
    acceptOffer,
    acceptAnswer,
    close,
    publishSequence,
    publishEngagement,
  };
}
