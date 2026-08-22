'use client';

import { useEffect, useRef } from 'react';
import { publishFrontierRuntimeHealth } from '@/lib/frontier/runtime/runtimeHealth';
import { boundedPeerEngagementDelta, pnCounterValueExcludingActor } from '@/lib/frontier/sync/meshEngagement';
import { decodeMeshVectorChunk, encodeMeshVectorChunk } from '@/lib/frontier/sync/meshChunkCodec';
import { publishFrontierMeshProfileUpdate } from '@/lib/frontier/sync/meshProfileEvents';
import { frontierSpatialGridKey } from '@/lib/frontier/vector/chunkedVectorStore';
import { listenFrontierSemanticTelemetry, semanticTelemetryWeight } from '@/lib/frontier/vector/telemetryEngine';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';
import { useChunkedVectorStore } from '../vector/useChunkedVectorStore';
import { useFrontierMeshSync } from './useFrontierMeshSync';

export const FRONTIER_MESH_COMMAND_EVENT = 'frontier:mesh-command';
export const FRONTIER_MESH_RESPONSE_EVENT = 'frontier:mesh-response';
const APPLIED_PEER_ENGAGEMENT_KEY = 'frontier-mesh-applied-peer-engagement-v1';

type MeshCommand = {
  action: 'create-offer' | 'accept-offer' | 'accept-answer' | 'close';
  payload?: string;
};

function loadAppliedPeerEngagement(): Record<string, number> {
  try {
    const raw = localStorage.getItem(APPLIED_PEER_ENGAGEMENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => (
      typeof value === 'number' && Number.isFinite(value) ? [[id, value]] : []
    )));
  } catch {
    return {};
  }
}

function persistAppliedPeerEngagement(values: Record<string, number>): void {
  try { localStorage.setItem(APPLIED_PEER_ENGAGEMENT_KEY, JSON.stringify(values)); } catch {}
}

/**
 * Keeps the CRDT replica warm without opening a network connection. WebRTC is
 * created only after an explicit pairing command. This preserves the local-only
 * default while making manual desktop/mobile pairing available to a thin UI.
 */
export function MeshStateBridge() {
  const importedHashes = useRef(new Set<string>());
  const appliedPeerEngagement = useRef<Record<string, number> | null>(null);
  const { putMany: archivePutMany, getIds: archiveGetIds, neighborhood: archiveNeighborhood } = useChunkedVectorStore();
  const {
    state,
    status,
    createOffer,
    acceptOffer,
    acceptAnswer,
    close,
    publishSequence,
    publishEngagement,
    publishChunk,
  } = useFrontierMeshSync();

  useEffect(() => {
    if (status === 'connected') publishFrontierRuntimeHealth('mesh', 'ready');
    else if (status === 'connecting') publishFrontierRuntimeHealth('mesh', 'starting');
    else if (status === 'failed') publishFrontierRuntimeHealth('mesh', 'degraded', { message: 'paired peer connection failed; local state retained' });
    else publishFrontierRuntimeHealth('mesh', 'idle');
  }, [status]);

  useEffect(() => listenFrontierSemanticTelemetry((event) => {
    const weight = semanticTelemetryWeight(event);
    if (Math.abs(weight) > 0.001) publishEngagement(event.item.id, weight);
    window.setTimeout(() => {
      void frontierVectorStore.getSequence().then(async (sequence) => {
        if (!sequence) return;
        publishSequence(sequence);
        try {
          const neighbors = await archiveNeighborhood(sequence.target, { maxChunks: 2, maxItems: 24 });
          if (!neighbors.length) return;
          const chunkId = `mesh:${frontierSpatialGridKey(sequence.target)}`;
          publishChunk(encodeMeshVectorChunk(chunkId, neighbors, event.at));
        } catch {
          // Peer chunk publication is best-effort; local memory remains primary.
        }
      }).catch(() => undefined);
    }, 100);
  }), [archiveNeighborhood, publishChunk, publishEngagement, publishSequence]);

  useEffect(() => {
    if (!state) return;
    for (const register of Object.values(state.chunks)) {
      const chunk = register.value;
      if (!chunk.payload || importedHashes.current.has(chunk.hash)) continue;
      importedHashes.current.add(chunk.hash);
      const entries = decodeMeshVectorChunk(chunk);
      if (!entries.length) continue;
      void archivePutMany(entries.map((entry) => ({
        id: entry.id,
        vector: entry.vector,
        textHash: entry.textHash,
        at: Math.max(entry.lastAccessedAt, chunk.updatedAt),
        metadata: {
          title: entry.title,
          sourceLabel: entry.sourceLabel,
          lane: entry.lane,
          publishedAt: entry.publishedAt,
          engagement: entry.engagement,
          lastSignalAt: entry.lastSignalAt,
        },
      }))).catch(() => undefined);
    }
  }, [archivePutMany, state]);

  useEffect(() => {
    if (!state) return;
    if (!appliedPeerEngagement.current) appliedPeerEngagement.current = loadAppliedPeerEngagement();
    const applied = appliedPeerEngagement.current;
    let cancelled = false;

    void (async () => {
      let changed = false;
      let profileChanged = false;
      for (const [itemId, counter] of Object.entries(state.engagements)) {
        if (cancelled) return;
        const remoteValue = pnCounterValueExcludingActor(counter, state.actorId);
        const previous = applied[itemId] ?? 0;
        if (Math.abs(remoteValue - previous) < 0.001) continue;
        const signal = boundedPeerEngagementDelta(remoteValue, previous);
        if (Math.abs(signal) < 0.001) {
          applied[itemId] = remoteValue;
          changed = true;
          continue;
        }

        let vector: Float32Array | undefined;
        try { vector = await frontierVectorStore.get(itemId); } catch {}
        if (!vector) {
          try {
            const archived = (await archiveGetIds([itemId]))[0];
            if (archived) {
              vector = archived.vector;
              await frontierVectorStore.put(
                archived.id,
                archived.vector,
                archived.textHash,
                Date.now(),
                {
                  title: archived.title,
                  sourceLabel: archived.sourceLabel,
                  lane: archived.lane,
                  publishedAt: archived.publishedAt,
                  engagement: archived.engagement,
                  lastSignalAt: archived.lastSignalAt,
                }
              );
            }
          } catch {}
        }
        if (!vector) continue;

        try {
          const at = Date.now();
          await frontierVectorStore.updateInterest(vector, signal, at);
          await frontierVectorStore.recordEngagement(itemId, signal, at);
          applied[itemId] = remoteValue;
          changed = true;
          profileChanged = true;
        } catch {
          // Keep the previous applied value so a later state pass can retry.
        }
      }
      if (!cancelled && changed) persistAppliedPeerEngagement(applied);
      if (!cancelled && profileChanged) publishFrontierMeshProfileUpdate();
    })();

    return () => { cancelled = true; };
  }, [archiveGetIds, state]);

  useEffect(() => {
    const respond = (detail: Record<string, unknown>) => {
      window.dispatchEvent(new CustomEvent(FRONTIER_MESH_RESPONSE_EVENT, { detail: { status, ...detail } }));
    };
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<MeshCommand>).detail;
      if (!command?.action) return;
      void (async () => {
        try {
          if (command.action === 'create-offer') {
            respond({ action: command.action, payload: await createOffer() });
            return;
          }
          if (command.action === 'accept-offer') {
            if (!command.payload) throw new Error('offer payload required');
            respond({ action: command.action, payload: await acceptOffer(command.payload) });
            return;
          }
          if (command.action === 'accept-answer') {
            if (!command.payload) throw new Error('answer payload required');
            await acceptAnswer(command.payload);
            respond({ action: command.action });
            return;
          }
          close();
          respond({ action: command.action });
        } catch (error) {
          respond({ action: command.action, error: error instanceof Error ? error.message : 'mesh command failed' });
        }
      })();
    };
    window.addEventListener(FRONTIER_MESH_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(FRONTIER_MESH_COMMAND_EVENT, onCommand);
  }, [acceptAnswer, acceptOffer, close, createOffer, status]);

  return null;
}
