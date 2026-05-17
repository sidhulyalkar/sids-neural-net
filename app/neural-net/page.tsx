import { Metadata } from 'next';
import { NeuralNetClient } from './NeuralNetClient';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';

export const metadata: Metadata = {
  title: 'Neural Net',
  description: 'Interactive graph visualization of projects, publications, skills, and connections.',
};

export default function NeuralNetPage() {
  // Parse and validate the graph data
  const graph = NeuralGraphSchema.parse(graphData);

  // Extract unique types and domains for filters
  const availableTypes = Array.from(new Set(graph.nodes.map((n) => n.type)));
  const availableDomains = Array.from(
    new Set(graph.nodes.flatMap((n) => n.domains))
  ).sort();

  return (
    <NeuralNetClient
      graph={graph}
      availableTypes={availableTypes}
      availableDomains={availableDomains}
    />
  );
}
