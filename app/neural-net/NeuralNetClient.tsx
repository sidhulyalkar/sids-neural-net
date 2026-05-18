'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const [selectedNode, setSelectedNode] = useState<NeuralNode | null>(null);
  const [filters, setFilters] = useState({
    types: [] as string[],
    domains: [] as string[],
    search: '',
  });

  // Handle focus query param: /neural-net?focus=some-slug
  useEffect(() => {
    const focusSlug = searchParams.get('focus');
    if (focusSlug && !selectedNode) {
      const node = graph.nodes.find(
        (n) => n.slug === focusSlug || n.id === focusSlug
      );
      if (node) {
        setSelectedNode(node);
      }
    }
  }, [searchParams, graph.nodes, selectedNode]);

  return (
    <div className="min-h-screen pt-20">
      <div className="flex h-[calc(100vh-5rem)]">
        {/* Sidebar */}
        <aside className="hidden w-80 overflow-y-auto border-r border-white/10 bg-bg-panel/55 p-5 backdrop-blur-xl lg:block">
          {/* Return to Atlas CTA */}
          <Link
            href="/"
            className="mb-5 flex items-center gap-2 text-sm text-cyan hover:text-cyan/80 transition-colors group"
            aria-label="Return to Neural Atlas"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Return to Atlas</span>
          </Link>

          <div className="mb-6">
            <p className="technical-label">Complete Archive</p>
            <h1 className="mt-2 text-2xl font-black text-text-primary">Full Neural Graph</h1>
            <p className="mt-1 text-sm text-text-secondary">
              The complete graph of all projects, publications, domains, and neural connections.
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
              <div className="node-shell p-2">
                <div className="text-lg font-bold text-cyan">{graph.nodes.length}</div>
                <div className="text-xs text-text-muted">Nodes</div>
              </div>
              <div className="node-shell p-2">
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
              <li>• Click a neuron to inspect</li>
              <li>• Scroll to zoom in/out</li>
              <li>• Drag to pan the view</li>
              <li>• Use filters to focus</li>
            </ul>
          </div>

          {/* Footer link to curated experience */}
          <div className="mt-6 pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-muted mb-2">
              Looking for the curated experience?
            </p>
            <Link
              href="/"
              className="signal-button w-full text-center"
            >
              Enter Neural Atlas
            </Link>
          </div>
        </aside>

        {/* Main Graph Area */}
        <main className="flex-1 relative">
          {/* Mobile Header */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 border border-white/10 bg-bg-panel/90 px-3 py-2 backdrop-blur-sm text-xs text-cyan hover:text-cyan/80 hover:border-cyan/30 transition-colors lg:hidden"
              aria-label="Return to Neural Atlas"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Atlas</span>
            </Link>
            <div className="border border-white/10 bg-bg-panel/90 p-2 backdrop-blur-sm lg:hidden">
              <span className="text-xs text-text-muted">
                {graph.nodes.length} nodes • {graph.edges.length} edges
              </span>
            </div>
          </div>

          <NeuralGraph
            graph={graph}
            onNodeSelect={setSelectedNode}
            selectedNodeId={selectedNode?.slug || null}
            filters={filters}
          />
        </main>

        {/* Node Inspector */}
        <NodeInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}
