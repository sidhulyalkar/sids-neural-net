'use client';

import { useMemo } from 'react';
import { Cosmograph, CosmographProvider } from '@cosmograph/react';
import { NeuralNode } from '@/lib/data/schemas';
import type { CosmographLink, CosmographNode } from './NeuralGraph';

interface CosmographCanvasProps {
  nodes: CosmographNode[];
  links: CosmographLink[];
  selectedNodeId: string | null;
  onNodeSelect: (node: NeuralNode | null) => void;
}

export function CosmographCanvas({
  nodes,
  links,
  selectedNodeId,
  onNodeSelect,
}: CosmographCanvasProps) {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute right-4 top-4 z-10 hidden lg:flex flex-wrap gap-2">
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-cyan/80 backdrop-blur-md">
          {nodes.length} neurons
        </span>
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-violet/70 backdrop-blur-md">
          {links.length} synapses
        </span>
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-text-muted backdrop-blur-md">
          hover to inspect
        </span>
      </div>

      <CosmographProvider nodes={nodes} links={links}>
        <Cosmograph
          className="h-full w-full"
          nodes={nodes}
          links={links}
          nodeColor={(node: CosmographNode) =>
            node.id === selectedNodeId ? '#f8fbff' : node.color
          }
          nodeSize={(node: CosmographNode) =>
            node.id === selectedNodeId ? node.size * 1.7 : node.size
          }
          nodeSizeScale={0.8}
          nodeLabelAccessor={(node: CosmographNode) => node.label}
          nodeLabelColor="#d9f7ff"
          hoveredNodeLabelColor="#f8fbff"
          hoveredNodeLabelClassName="cosmograph-hover-label"
          showDynamicLabels={false}
          showTopLabels={false}
          showHoveredNodeLabel
          showLabelsFor={selectedNode ? [selectedNode] : []}
          linkColor={(link: CosmographLink) => link.color}
          linkWidth={(link: CosmographLink) => Math.max(0.45, link.weight / 7)}
          linkWidthScale={0.12}
          backgroundColor="transparent"
          renderHoveredNodeRing
          hoveredNodeRingColor="#66e3ff"
          focusedNodeRingColor="#f8fbff"
          simulationDecay={900}
          simulationGravity={0.08}
          simulationRepulsion={0.92}
          simulationLinkSpring={0.32}
          simulationLinkDistance={42}
          simulationFriction={0.86}
          fitViewOnInit
          fitViewDelay={900}
          scaleNodesOnZoom={false}
          onClick={(node: CosmographNode | undefined) => {
            onNodeSelect(node?.neuralNode ?? null);
          }}
          onLabelClick={(node: CosmographNode) => {
            onNodeSelect(node.neuralNode);
          }}
        />
      </CosmographProvider>
    </div>
  );
}
