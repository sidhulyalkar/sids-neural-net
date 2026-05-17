'use client';

import { useState } from 'react';
import { NeuralGraph, NodeInspector, GraphFilters } from '@/components/neural-net';
import { NeuralNode, NeuralGraph as NeuralGraphType } from '@/lib/data/schemas';

interface NeuralNetClientProps {
  graph: NeuralGraphType;
  availableTypes: string[];
  availableDomains: string[];
}

export function NeuralNetClient({
  graph,
  availableTypes,
  availableDomains,
}: NeuralNetClientProps) {
  const [selectedNode, setSelectedNode] = useState<NeuralNode | null>(null);
  const [filters, setFilters] = useState({
    types: [] as string[],
    domains: [] as string[],
    search: '',
  });

  return (
    <div className="min-h-screen pt-16">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-72 bg-bg-panel border-r border-border-subtle p-4 overflow-y-auto hidden lg:block">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-text-primary">Neural Net</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Explore the interconnected graph of projects, publications, and skills.
            </p>
          </div>

          <GraphFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableTypes={availableTypes}
            availableDomains={availableDomains}
          />

          {/* Stats */}
          <div className="mt-6 pt-4 border-t border-border-subtle">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-bg-deep rounded-lg">
                <div className="text-lg font-bold text-cyan">{graph.nodes.length}</div>
                <div className="text-xs text-text-muted">Nodes</div>
              </div>
              <div className="p-2 bg-bg-deep rounded-lg">
                <div className="text-lg font-bold text-violet">{graph.edges.length}</div>
                <div className="text-xs text-text-muted">Connections</div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">Legend</h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan" />
                <span className="text-xs text-text-secondary">Projects</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet" />
                <span className="text-xs text-text-secondary">Publications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber" />
                <span className="text-xs text-text-secondary">Roles & Studies</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green" />
                <span className="text-xs text-text-secondary">Organizations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose" />
                <span className="text-xs text-text-secondary">Personal</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">Navigation</h3>
            <ul className="space-y-1 text-xs text-text-secondary">
              <li>• Click a node to see details</li>
              <li>• Scroll to zoom in/out</li>
              <li>• Drag to pan the view</li>
              <li>• Use filters to focus</li>
            </ul>
          </div>
        </aside>

        {/* Main Graph Area */}
        <main className="flex-1 relative">
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden absolute top-4 left-4 z-10">
            <div className="bg-bg-panel/90 backdrop-blur-sm border border-border-subtle rounded-lg p-2">
              <span className="text-xs text-text-muted">
                {graph.nodes.length} nodes • {graph.edges.length} edges
              </span>
            </div>
          </div>

          <NeuralGraph
            graph={graph}
            onNodeSelect={setSelectedNode}
            selectedNodeId={selectedNode?.id || null}
            filters={filters}
          />
        </main>

        {/* Node Inspector */}
        <NodeInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}
