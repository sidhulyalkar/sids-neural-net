'use client';

import { useMemo } from 'react';
import { AdditiveBlending } from 'three';
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
  const showCategorySubnetwork =
    Boolean(activeCategoryId) &&
    (Boolean(selectedLeafId) ||
      transitionPhase === 'arriving' ||
      transitionPhase === 'category' ||
      transitionPhase === 'detail' ||
      transitionPhase === 'reading');
  const visibleNodes = useMemo(() => {
    if (!activeCategoryId) return graph.nodes.filter((node) => node.kind === 'category');
    if (!showCategorySubnetwork) return graph.nodes.filter((node) => node.kind === 'category');

    return graph.nodes.filter(
      (node) =>
        node.id === 'about' ||
        node.id === activeCategoryId ||
        node.parentId === activeCategoryId ||
        node.id === selectedLeafId
    );
  }, [activeCategoryId, graph.nodes, selectedLeafId, showCategorySubnetwork]);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const ghostLeaves = useMemo(
    () =>
      activeCategoryId
        ? graph.categories.filter((node) => node.id !== 'about' && node.id !== activeCategoryId)
        : graph.nodes.filter((node) => node.kind === 'leaf' && node.featured).slice(0, 42),
    [activeCategoryId, graph.categories, graph.nodes]
  );
  const rootInBackground = Boolean(activeCategoryId);

  return (
    <group>
      <group position={[0, 0, rootInBackground ? -1.4 : -2.2]}>
        {ghostLeaves.map((node) => (
          <mesh key={`ghost:${node.id}`} position={[node.position.x, node.position.y, node.position.z - 1.6]} scale={node.kind === 'category' ? 0.18 : 0.07}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={node.color}
              transparent
              opacity={rootInBackground ? 0.08 : 0.045}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
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
