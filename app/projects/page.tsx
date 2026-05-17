import { Metadata } from 'next';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { ProjectsClient } from './ProjectsClient';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'A searchable directory of all projects spanning neuroscience, ML, infrastructure, and creative experiments.',
};

export default function ProjectsPage() {
  const graph = NeuralGraphSchema.parse(graphData);

  // Filter for projects only
  const projects = graph.nodes.filter((n) => n.type === 'project');

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
