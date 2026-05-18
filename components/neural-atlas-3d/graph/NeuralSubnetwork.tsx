'use client';

import { useMemo } from 'react';
import type { AtlasGraph } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';
import { DendriteCurve } from './DendriteCurve';
import { NeuralNode3D } from './NeuralNode3D';
import { SignalPulse } from './SignalPulse';

type NeuralSubnetworkProps = {
  graph: AtlasGraph;
};

export function NeuralSubnetwork({ graph }: NeuralSubnetworkProps) {
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const hoveredNodeId = useAtlasStore((state) => state.hoveredNodeId);
  const activeNodeId = useAtlasStore((state) => state.activeNodeId);
  const signalPath = useAtlasStore((state) => state.signalPath);
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter((node) => node.kind === 'category'),
    [graph.nodes]
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  return (
    <group>
      {graph.edges.map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
        const signaling = isSignalEdge(edge.id, edge.source, edge.target, signalPath);
        const inMotion = transitionPhase === 'charging' || transitionPhase === 'traveling' || transitionPhase === 'arriving';
        const highlighted =
          signaling ||
          hoveredNodeId === edge.source ||
          hoveredNodeId === edge.target ||
          activeCategoryId === edge.source ||
          activeCategoryId === edge.target ||
          activeNodeId === edge.source ||
          activeNodeId === edge.target ||
          selectedLeafId === edge.source ||
          selectedLeafId === edge.target;
        return (
          <group key={edge.id}>
            <DendriteCurve
              edge={edge}
              source={source}
              target={target}
              highlighted={highlighted}
              signaling={signaling && inMotion}
            />
            <SignalPulse active={signaling && inMotion} edge={edge} source={source} target={target} />
          </group>
        );
      })}
      {visibleNodes.map((node) => (
        <NeuralNode3D key={node.id} node={node} />
      ))}
    </group>
  );
}

function isSignalEdge(edgeId: string, sourceId: string, targetId: string, signalPath: string[] | string | null) {
  if (!signalPath) return false;
  if (typeof signalPath === 'string') return signalPath === edgeId;

  for (let index = 0; index < signalPath.length - 1; index += 1) {
    const source = signalPath[index];
    const target = signalPath[index + 1];
    if ((source === sourceId && target === targetId) || (source === targetId && target === sourceId)) return true;
  }

  return false;
}
