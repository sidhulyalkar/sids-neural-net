'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NeuralNode, NeuralEdge, NeuralGraph as NeuralGraphType } from '@/lib/data/schemas';
import { useMode } from '@/lib/contexts/ModeContext';
import { filterByMode, getNodeRadius, getNodeOpacity, shouldGlow } from '@/lib/graph/ranking';

interface NeuralGraphProps {
  graph: NeuralGraphType;
  onNodeSelect: (node: NeuralNode | null) => void;
  selectedNodeId: string | null;
  filters: {
    types: string[];
    domains: string[];
    search: string;
  };
}

const NODE_COLORS: Record<string, string> = {
  project: '#66e3ff',
  publication: '#a78bfa',
  role: '#f7c66b',
  organization: '#66f0c2',
  skill: '#ff7aa2',
  technology: '#66e3ff',
  concept: '#a78bfa',
  'case-study': '#f7c66b',
  'field-note': '#66f0c2',
  'learning-trail': '#ff7aa2',
  'personal-interest': '#ff7aa2',
  milestone: '#f7c66b',
};

function NeuralNodeComponent({ data }: NodeProps) {
  const node = data.neuralNode as NeuralNode;
  const isSelected = data.isSelected as boolean;
  const importance = node.computedImportance ?? node.importance;
  const radius = getNodeRadius(importance);
  const opacity = getNodeOpacity(importance);
  const glows = shouldGlow(importance);
  const color = NODE_COLORS[node.type] || '#66e3ff';

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Glow effect */}
      {glows && (
        <div
          className="absolute inset-0 rounded-full blur-xl animate-pulse"
          style={{
            backgroundColor: color,
            opacity: 0.3,
            transform: 'scale(2)',
          }}
        />
      )}

      {/* Node circle */}
      <div
        className={`rounded-full cursor-pointer transition-all duration-200 ${
          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-deep' : ''
        }`}
        style={{
          width: radius * 2,
          height: radius * 2,
          backgroundColor: color,
          opacity: isSelected ? 1 : opacity,
          boxShadow: isSelected ? `0 0 20px ${color}` : 'none',
        }}
      />

      {/* Label on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-bg-panel border border-border-subtle rounded-md px-2 py-1 whitespace-nowrap">
          <span className="text-xs text-text-primary font-medium">{node.title}</span>
          <span className="text-xs text-text-muted ml-1">({node.type})</span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  neural: NeuralNodeComponent,
};

type FlowNode = Node<{ neuralNode: NeuralNode; isSelected: boolean }>;
type FlowEdge = Edge;

export function NeuralGraph({ graph, onNodeSelect, selectedNodeId, filters }: NeuralGraphProps) {
  const { mode } = useMode();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Filter and transform nodes
  const filteredNodes = useMemo(() => {
    let filtered = filterByMode(graph.nodes, mode);

    // Apply type filter
    if (filters.types.length > 0) {
      filtered = filtered.filter((n) => filters.types.includes(n.type));
    }

    // Apply domain filter
    if (filters.domains.length > 0) {
      filtered = filtered.filter((n) =>
        n.domains.some((d) => filters.domains.includes(d))
      );
    }

    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(search) ||
          n.summary?.toLowerCase().includes(search) ||
          n.tags.some((t) => t.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [graph.nodes, mode, filters]);

  // Transform to React Flow nodes with force layout
  useEffect(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Simple force-directed layout simulation
    const positions = computeForceLayout(filteredNodes, graph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    ));

    const flowNodes: FlowNode[] = filteredNodes.map((node) => {
      const pos = positions.get(node.id) || { x: Math.random() * 1000, y: Math.random() * 800 };
      return {
        id: node.id,
        type: 'neural',
        position: pos,
        data: {
          neuralNode: node,
          isSelected: node.id === selectedNodeId,
        },
      };
    });

    const flowEdges: FlowEdge[] = graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: {
          stroke: 'rgba(102, 227, 255, 0.2)',
          strokeWidth: 1,
        },
        animated: edge.weight > 0.7,
      }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [filteredNodes, graph.edges, selectedNodeId, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      onNodeSelect(node.data.neuralNode);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="w-full h-full bg-bg-deep rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1f36" gap={20} size={1} />
        <Controls
          className="!bg-bg-panel !border-border-subtle !rounded-lg [&_button]:!bg-bg-panel [&_button]:!border-border-subtle [&_button]:!text-text-secondary [&_button:hover]:!bg-bg-panel/80"
        />
        <MiniMap
          nodeColor={(node) => {
            const neuralNode = node.data?.neuralNode as NeuralNode | undefined;
            return NODE_COLORS[neuralNode?.type || 'project'] || '#66e3ff';
          }}
          className="!bg-bg-panel !border-border-subtle !rounded-lg"
          maskColor="rgba(5, 9, 20, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}

// Simple force layout computation
function computeForceLayout(
  nodes: NeuralNode[],
  edges: NeuralEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Initialize positions in a grid pattern based on importance clusters
  const sortedNodes = [...nodes].sort(
    (a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance)
  );

  // Group by cluster or domain
  const clusters = new Map<string, NeuralNode[]>();
  sortedNodes.forEach((node) => {
    const cluster = node.cluster || node.domains[0] || 'Other';
    if (!clusters.has(cluster)) {
      clusters.set(cluster, []);
    }
    clusters.get(cluster)!.push(node);
  });

  // Arrange clusters in a circle
  const clusterArray = Array.from(clusters.entries());
  const clusterRadius = 400;
  const centerX = 600;
  const centerY = 400;

  clusterArray.forEach(([, clusterNodes], clusterIndex) => {
    const clusterAngle = (clusterIndex / clusterArray.length) * 2 * Math.PI;
    const clusterCenterX = centerX + Math.cos(clusterAngle) * clusterRadius;
    const clusterCenterY = centerY + Math.sin(clusterAngle) * clusterRadius;

    // Arrange nodes within cluster in a smaller circle
    const nodeRadius = Math.min(150, 30 * Math.sqrt(clusterNodes.length));
    clusterNodes.forEach((node, nodeIndex) => {
      const nodeAngle = (nodeIndex / clusterNodes.length) * 2 * Math.PI;
      const x = clusterCenterX + Math.cos(nodeAngle) * nodeRadius + (Math.random() - 0.5) * 30;
      const y = clusterCenterY + Math.sin(nodeAngle) * nodeRadius + (Math.random() - 0.5) * 30;
      positions.set(node.id, { x, y });
    });
  });

  // Simple force iterations to adjust
  const edgeMap = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, new Set());
    if (!edgeMap.has(e.target)) edgeMap.set(e.target, new Set());
    edgeMap.get(e.source)!.add(e.target);
    edgeMap.get(e.target)!.add(e.source);
  });

  // Run a few iterations of spring layout
  for (let iter = 0; iter < 50; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    nodes.forEach((n) => forces.set(n.id, { fx: 0, fy: 0 }));

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pos1 = positions.get(nodes[i].id)!;
        const pos2 = positions.get(nodes[j].id)!;
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(nodes[i].id)!.fx -= fx;
        forces.get(nodes[i].id)!.fy -= fy;
        forces.get(nodes[j].id)!.fx += fx;
        forces.get(nodes[j].id)!.fy += fy;
      }
    }

    // Attraction along edges
    edges.forEach((e) => {
      const pos1 = positions.get(e.source);
      const pos2 = positions.get(e.target);
      if (!pos1 || !pos2) return;
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (forces.has(e.source)) {
        forces.get(e.source)!.fx += fx;
        forces.get(e.source)!.fy += fy;
      }
      if (forces.has(e.target)) {
        forces.get(e.target)!.fx -= fx;
        forces.get(e.target)!.fy -= fy;
      }
    });

    // Apply forces
    nodes.forEach((n) => {
      const pos = positions.get(n.id)!;
      const f = forces.get(n.id)!;
      pos.x += Math.max(-10, Math.min(10, f.fx * 0.1));
      pos.y += Math.max(-10, Math.min(10, f.fy * 0.1));
    });
  }

  return positions;
}
