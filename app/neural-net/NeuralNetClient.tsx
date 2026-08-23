'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NeuralGraph, NodeInspector, GraphFilters } from '@/components/neural-net';
import type { NeuralNode, NeuralGraph as NeuralGraphType } from '@/lib/data/schemas';

interface NeuralNetClientProps {
  graph: NeuralGraphType;
  availableTypes: string[];
  availableDomains: string[];
}

export function NeuralNetClient({ graph, availableTypes, availableDomains }: NeuralNetClientProps) {
  const searchParams = useSearchParams();
  const [selectedOverride, setSelectedOverride] = useState<NeuralNode | null | undefined>(undefined);
  const [filters, setFilters] = useState({ types: [] as string[], domains: [] as string[], search: '' });

  const queryFocusedNode = useMemo(() => {
    const focusSlug = searchParams.get('focus');
    if (!focusSlug) return null;
    return graph.nodes.find((node) => node.slug === focusSlug || node.id === focusSlug) ?? null;
  }, [graph.nodes, searchParams]);
  const selectedNode = selectedOverride === undefined ? queryFocusedNode : selectedOverride;

  return (
    <div className="min-h-screen pt-20">
      <div className="flex h-[calc(100vh-5rem)]">
        <aside className="hidden w-80 overflow-y-auto border-r border-white/10 bg-bg-panel/55 p-5 backdrop-blur-xl lg:block">
          <Link href="/" className="group mb-5 flex items-center gap-2 text-sm text-cyan transition-colors hover:text-cyan/80" aria-label="Return to home">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /><span>Return home</span>
          </Link>

          <div className="mb-6">
            <p className="technical-label">Complete Archive</p>
            <h1 className="mt-2 text-2xl font-black text-text-primary">Graph Archive</h1>
            <p className="mt-1 text-sm text-text-secondary">The complete graph of all builds, publications, domains, and neural connections.</p>
          </div>

          <GraphFilters filters={filters} onFiltersChange={setFilters} availableTypes={availableTypes} availableDomains={availableDomains} />

          <div className="mt-6 border-t border-border-subtle pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="node-shell p-2"><div className="text-lg font-bold text-cyan">{graph.nodes.length}</div><div className="text-xs text-text-muted">Nodes</div></div>
              <div className="node-shell p-2"><div className="text-lg font-bold text-violet">{graph.edges.length}</div><div className="text-xs text-text-muted">Connections</div></div>
            </div>
          </div>

          <div className="mt-4 border-t border-border-subtle pt-4">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">Legend</h3>
            <div className="space-y-1">
              {[['bg-cyan', 'Builds'], ['bg-violet', 'Publications'], ['bg-amber', 'Roles & Studies'], ['bg-green', 'Organizations'], ['bg-rose', 'Personal']].map(([color, label]) => (
                <div className="flex items-center gap-2" key={label}><div className={`h-3 w-3 rounded-full ${color}`} /><span className="text-xs text-text-secondary">{label}</span></div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-border-subtle pt-4">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">Navigation</h3>
            <ul className="space-y-1 text-xs text-text-secondary"><li>• Click a neuron to inspect</li><li>• Scroll to zoom in/out</li><li>• Drag to pan the view</li><li>• Use filters to focus</li></ul>
          </div>

          <div className="mt-6 border-t border-border-subtle pt-4">
            <p className="mb-2 text-xs text-text-muted">Looking for the curated experience?</p>
            <Link href="/" className="signal-button w-full text-center">Enter home</Link>
          </div>
        </aside>

        <main className="relative flex-1">
          <div className="absolute left-4 top-4 z-10 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 border border-white/10 bg-bg-panel/90 px-3 py-2 text-xs text-cyan backdrop-blur-sm transition-colors hover:border-cyan/30 hover:text-cyan/80 lg:hidden" aria-label="Return to home">
              <ArrowLeft className="h-3.5 w-3.5" /><span>Home</span>
            </Link>
            <div className="border border-white/10 bg-bg-panel/90 p-2 backdrop-blur-sm lg:hidden"><span className="text-xs text-text-muted">{graph.nodes.length} nodes • {graph.edges.length} edges</span></div>
          </div>

          <NeuralGraph graph={graph} onNodeSelect={setSelectedOverride} selectedNodeId={selectedNode?.slug || null} filters={filters} />
        </main>

        <NodeInspector node={selectedNode} onClose={() => setSelectedOverride(null)} />
      </div>
    </div>
  );
}
