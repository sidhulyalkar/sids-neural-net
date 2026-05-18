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
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter(
        (node) => node.kind === 'category' || (!activeCategoryId ? false : node.parentId === activeCategoryId)
      ),
    [activeCategoryId, graph.nodes]
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  return (
    <group>
      {graph.edges.map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
        return (
          <group key={edge.id}>
            <DendriteCurve edge={edge} source={source} target={target} />
            <SignalPulse active={selectedLeafId === edge.source || selectedLeafId === edge.target} edge={edge} source={source} target={target} />
          </group>
        );
      })}
      {visibleNodes.map((node) => (
        <NeuralNode3D key={node.id} node={node} />
      ))}
    </group>
  );
}
