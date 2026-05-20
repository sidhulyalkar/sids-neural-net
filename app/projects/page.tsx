import { Metadata } from 'next';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { filterProfessionalProjects } from '@/lib/graph/professional-projects';
import { ProjectsClient } from './ProjectsClient';

export const metadata: Metadata = {
  title: 'Builds',
  description:
    'Selected builds by Sidharth Hulyalkar spanning neuroscience data infrastructure, multimodal ML, BCI systems, applied AI, and creative engineering.',
  alternates: {
    canonical: '/projects',
  },
  openGraph: {
    title: 'Builds | Sids Neural Net',
    description:
      'Searchable builds across neuroscience infrastructure, ML research, BCI systems, and applied AI.',
    url: '/projects',
  },
};

export default function ProjectsPage() {
  const graph = NeuralGraphSchema.parse(graphData);

  // Filter for professional build nodes only.
  const projects = filterProfessionalProjects(graph.nodes);

  // Get unique domains for filtering
  const availableDomains = Array.from(
    new Set(projects.flatMap((p) => p.domains))
  ).sort();

  // Get unique tags for filtering (top ones)
  const tagCounts = new Map<string, number>();
  projects.forEach((p) => {
    p.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const availableTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  return (
    <ProjectsClient
      projects={projects}
      availableDomains={availableDomains}
      availableTags={availableTags}
    />
  );
}
