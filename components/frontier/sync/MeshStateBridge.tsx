'use client';

import { useEffect } from 'react';
import { listenFrontierSemanticTelemetry, semanticTelemetryWeight } from '@/lib/frontier/vector/telemetryEngine';
import { frontierVectorStore } from '@/lib/frontier/vector/vectorStore';
import { useFrontierMeshSync } from './useFrontierMeshSync';

export const FRONTIER_MESH_COMMAND_EVENT = 'frontier:mesh-command';
export const FRONTIER_MESH_RESPONSE_EVENT = 'frontier:mesh-response';

type MeshCommand = {
  action: 'create-offer' | 'accept-offer' | 'accept-answer' | 'close';
  payload?: string;
};

/**
 * Keeps the CRDT replica warm without opening a network connection. WebRTC is
 * created only after an explicit pairing command. This preserves the local-only
 * default while making manual desktop/mobile pairing available to a thin UI.
 */
export function MeshStateBridge() {
  const {
    status,
    createOffer,
    acceptOffer,
    acceptAnswer,
    close,
    publishSequence,
    publishEngagement,
  } = useFrontierMeshSync();

  useEffect(() => listenFrontierSemanticTelemetry((event) => {
    const weight = semanticTelemetryWeight(event);
    if (Math.abs(weight) > 0.001) publishEngagement(event.item.id, weight);
    window.setTimeout(() => {
      void frontierVectorStore.getSequence().then((sequence) => {
        if (sequence) publishSequence(sequence);
      }).catch(() => undefined);
    }, 80);
  }), [publishEngagement, publishSequence]);

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
