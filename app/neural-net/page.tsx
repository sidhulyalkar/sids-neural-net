import { Metadata } from 'next';
import { Suspense } from 'react';
import { NeuralNetClient } from './NeuralNetClient';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';

export const metadata: Metadata = {
  title: 'Graph Archive',
  description:
    'Interactive graph archive of Sidharth Hulyalkar builds, publications, domains, and portfolio connections.',
  alternates: {
    canonical: '/neural-net',
  },
  openGraph: {
    title: 'Graph Archive | Sid Neural Net',
    description: 'A power-user graph archive for builds, publications, domains, and portfolio connections.',
    url: '/neural-net',
  },
};

function NeuralNetLoading() {
  return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="neural-panel neural-panel-cut p-6">
        <p className="technical-label">Loading Archive</p>
        <p className="mt-2 text-sm text-text-secondary">Initializing neural graph...</p>
      </div>
    </div>
  );
}

export default function NeuralNetPage() {
  // Parse and validate the graph data
  const graph = NeuralGraphSchema.parse(graphData);

  // Extract unique types and domains for filters
  const availableTypes = Array.from(new Set(graph.nodes.map((n) => n.type)));
  const availableDomains = Array.from(
    new Set(graph.nodes.flatMap((n) => n.domains))
  ).sort();

  return (
    <Suspense fallback={<NeuralNetLoading />}>
      <NeuralNetClient
        graph={graph}
        availableTypes={availableTypes}
        availableDomains={availableDomains}
      />
    </Suspense>
  );
}
