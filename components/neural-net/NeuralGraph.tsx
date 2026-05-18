'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { NeuralNode, NeuralGraph as NeuralGraphType } from '@/lib/data/schemas';
import { useMode } from '@/lib/contexts/ModeContext';
import { filterByMode, getNodeRadius } from '@/lib/graph/ranking';

const CosmographCanvas = dynamic(
  () => import('./CosmographCanvas').then((mod) => mod.CosmographCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-bg-deep">
        <div className="neural-panel neural-panel-cut p-4">
          <p className="technical-label">Loading Cosmograph</p>
          <p className="mt-2 text-sm text-text-secondary">Initializing GPU graph renderer...</p>
        </div>
      </div>
    ),
  }
);

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

export type CosmographNode = {
  id: string;
  label: string;
  fullTitle: string;
  type: string;
  domain: string;
  color: string;
  size: number;
  importance: number;
  neuralNode: NeuralNode;
};

export type CosmographLink = {
  id: string;
  source: string;
  target: string;
  weight: number;
  color: string;
};

const CLUSTER_KEYS = [
  'DataJoint',
  'UCSD',
  'NEATLABs',
  'BCI',
  'neurOS',
  'NeuroForge',
  'Panoptic',
  'Mechanistic Interpretability',
  'Foundation Models',
  'Shasta',
];

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

const SHORT_LABEL_OVERRIDES: Record<string, string> = {
  'datajoint-multimodal-pipelines': 'DataJoint',
  'harvard-sabatini-pipeline': 'Sabatini',
  'neatlabs-core-research': 'NEATLABs',
  'neurofmx-neuros': 'neuroFMx',
  'neuros-v1': 'neurOS',
  'panoptic-bio': 'Panoptic',
  'petpath': 'PetPath',
  'petnet': 'PetNet',
};

function getShortLabel(node: NeuralNode): string {
  const override = SHORT_LABEL_OVERRIDES[node.slug];
  if (override) return override;

  const cleaned = node.title
    .replace(/^Scaling\s+/i, '')
    .replace(/^Building\s+/i, '')
    .replace(/^Published:\s*/i, '')
    .replace(/\s+with\s+.+$/i, '')
    .replace(/\s*[:|/]\s*.+$/i, '')
    .replace(/\b(multimodal|neuroscience|pipeline|pipelines|project|system|systems|framework|application)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const label = cleaned || node.title;
  if (label.length <= 22) return label;

  const words = label.split(/\s+/).filter(Boolean);
  const shortWords = words.slice(0, 3).join(' ');
  return shortWords.length <= 22 ? shortWords : `${label.slice(0, 19)}...`;
}

export function NeuralGraph({ graph, onNodeSelect, selectedNodeId, filters }: NeuralGraphProps) {
  const { mode } = useMode();

  const filteredNodes = useMemo(() => {
    let filtered = filterByMode(graph.nodes, mode);

    if (filters.types.length > 0) {
      filtered = filtered.filter((node) => filters.types.includes(node.type));
    }

    if (filters.domains.length > 0) {
      filtered = filtered.filter((node) =>
        node.domains.some((domain) => filters.domains.includes(domain))
      );
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (node) =>
          node.title.toLowerCase().includes(search) ||
          node.summary?.toLowerCase().includes(search) ||
          node.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [graph.nodes, mode, filters]);

  const { nodes, links } = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((node) => node.slug));
    const cosmographNodes: CosmographNode[] = filteredNodes.map((node) => {
      const importance = node.computedImportance ?? node.importance;

      return {
        id: node.slug,
        label: getShortLabel(node),
        fullTitle: node.title,
        type: node.type,
        domain: node.cluster || node.domains[0] || 'Unclustered',
        color: NODE_COLORS[node.type] || '#66e3ff',
        size: Math.max(4, getNodeRadius(importance) * 0.95),
        importance,
        neuralNode: node,
      };
    });

    const edgeLinks: CosmographLink[] = graph.edges
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        color: edge.weight >= 7 ? 'rgba(102, 227, 255, 0.42)' : 'rgba(102, 227, 255, 0.16)',
      }));

    const clusterLinks = createClusterLinks(filteredNodes, new Set(edgeLinks.map((link) => link.id)));

    return { nodes: cosmographNodes, links: [...edgeLinks, ...clusterLinks] };
  }, [filteredNodes, graph.edges]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-deep">
      <CosmographCanvas
        nodes={nodes}
        links={links}
        selectedNodeId={selectedNodeId}
        onNodeSelect={onNodeSelect}
      />
    </div>
  );
}

function createClusterLinks(nodes: NeuralNode[], existingIds: Set<string>): CosmographLink[] {
  const links: CosmographLink[] = [];

  for (const key of CLUSTER_KEYS) {
    const cluster = nodes
      .filter((node) => {
        const haystack = [
          node.title,
          node.slug,
          node.cluster ?? '',
          ...node.domains,
          ...node.tags,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(key.toLowerCase());
      })
      .sort((a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance))
      .slice(0, 8);

    for (let index = 0; index < cluster.length - 1; index += 1) {
      const source = cluster[index].slug;
      const target = cluster[index + 1].slug;
      const id = `cluster:${key}:${source}:${target}`;
      if (existingIds.has(id)) continue;

      links.push({
        id,
        source,
        target,
        weight: 8,
        color: key === 'DataJoint' || key === 'UCSD'
          ? 'rgba(102, 227, 255, 0.48)'
          : 'rgba(102, 240, 194, 0.32)',
      });
    }
  }

  return links;
}
