/**
 * Neural Graph Builder
 *
 * Combines GitHub repos, manual overrides, context docs, and publications
 * into a unified neural graph for the website.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import matter from 'gray-matter';
import type { NeuralNode, NeuralEdge, NeuralGraph } from '../lib/data/schemas';
import { computeNodeImportance, getVisualWeight } from '../lib/graph/ranking';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTENT_DIR = path.join(process.cwd(), 'content');
const CONTEXT_PACK_DIR = path.join(
  process.cwd(),
  'sids_neural_net_project_context_pack'
);

interface GitHubRepo {
  id: string;
  slug: string;
  type: 'project';
  title: string;
  summary: string;
  source: 'github';
  sourceUrl: string;
  tags: string[];
  domains: string[];
  status: 'active' | 'archived';
  updatedAt: string;
  createdAt: string;
  github: {
    owner: string;
    repo: string;
    stars: number;
    forks: number;
    language: string | null;
    isFork: boolean;
    pushedAt: string;
    createdAt: string;
    topics: string[];
    description: string | null;
    url: string;
  };
}

interface ManualOverride {
  slug: string;
  importance?: number;
  title?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  domains?: string[];
  featured?: boolean;
  modeVisibility?: string[];
  cluster?: string;
  status?: string;
}

interface Publication {
  id: string;
  title: string;
  year: number;
  authors: string[];
  venue: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  tags: string[];
  importance: number;
  domains: string[];
  modeVisibility: string[];
}

async function loadGitHubRepos(): Promise<GitHubRepo[]> {
  const filePath = path.join(DATA_DIR, 'generated', 'github-repos.json');
  if (!existsSync(filePath)) {
    console.log('No GitHub repos found, skipping...');
    return [];
  }
  const data = await readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function loadManualOverrides(): Promise<Map<string, ManualOverride>> {
  const filePath = path.join(DATA_DIR, 'manual', 'project-overrides.yaml');
  if (!existsSync(filePath)) {
    console.log('No manual overrides found, skipping...');
    return new Map();
  }
  const data = await readFile(filePath, 'utf-8');
  const parsed = YAML.parse(data);
  const map = new Map<string, ManualOverride>();

  if (parsed?.overrides) {
    for (const [slug, override] of Object.entries(parsed.overrides)) {
      map.set(slug, { slug, ...(override as object) } as ManualOverride);
    }
  }

  return map;
}

async function loadPublications(): Promise<Publication[]> {
  const filePath = path.join(DATA_DIR, 'manual', 'publications.yaml');
  if (!existsSync(filePath)) {
    console.log('No publications found, skipping...');
    return [];
  }
  const data = await readFile(filePath, 'utf-8');
  const parsed = YAML.parse(data);
  return parsed?.publications ?? [];
}

async function loadContextDocs(): Promise<NeuralNode[]> {
  const nodes: NeuralNode[] = [];

  // Check for context pack
  if (!existsSync(CONTEXT_PACK_DIR)) {
    console.log('No context pack found, skipping...');
    return nodes;
  }

  const files = await readdir(CONTEXT_PACK_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('00_'));

  for (const file of mdFiles) {
    try {
      const content = await readFile(path.join(CONTEXT_PACK_DIR, file), 'utf-8');
      const { data: frontmatter, content: body } = matter(content);

      // Extract metadata from content
      const titleMatch = body.match(/^# Project Context: (.+)$/m);
      const title = titleMatch?.[1] ?? file.replace('.md', '');

      const onelineMatch = body.match(/## One-liner\n\n(.+)/);
      const summary = onelineMatch?.[1] ?? '';

      const importanceMatch = body.match(/\*\*Importance:\*\* (\d+)/);
      const importance = importanceMatch ? parseInt(importanceMatch[1]) : 70;

      const clusterMatch = body.match(/\*\*Primary cluster:\*\* (.+)/);
      const cluster = clusterMatch?.[1] ?? '';

      // Extract tags from Neural Net Connections section
      const connectionsMatch = body.match(
        /## (?:Suggested )?Neural Net Connections\n\n([\s\S]*?)(?=\n## |$)/
      );
      const tags: string[] = [];
      if (connectionsMatch) {
        const lines = connectionsMatch[1].split('\n');
        lines.forEach((line) => {
          const tag = line.replace(/^- /, '').trim();
          if (tag) tags.push(tag);
        });
      }

      const slug = file
        .replace('.md', '')
        .replace(/^\d+_/, '')
        .toLowerCase()
        .replace(/_/g, '-');

      nodes.push({
        id: `context:${slug}`,
        slug,
        type: 'project',
        title,
        summary,
        tags,
        domains: cluster ? [cluster] : [],
        importance,
        recencyScore: 50,
        credibilityScore: 80,
        visualWeight: getVisualWeight(importance),
        status: 'complete',
        source: 'context-doc',
        featured: importance >= 90,
        modeVisibility: ['full-brain', 'recruiter', 'researcher'],
        cluster,
      } as NeuralNode);
    } catch (e) {
      console.warn(`Error parsing ${file}:`, e);
    }
  }

  return nodes;
}

function mergeNodes(
  githubRepos: GitHubRepo[],
  overrides: Map<string, ManualOverride>,
  contextDocs: NeuralNode[],
  publications: Publication[]
): NeuralNode[] {
  const nodes = new Map<string, NeuralNode>();

  // Add GitHub repos first
  for (const repo of githubRepos) {
    const override = overrides.get(repo.slug);

    const node: NeuralNode = {
      id: repo.id,
      slug: repo.slug,
      type: 'project',
      title: override?.title ?? repo.title,
      summary: override?.summary ?? repo.summary,
      description: override?.description,
      tags: override?.tags ?? repo.tags,
      domains: override?.domains ?? repo.domains,
      importance: override?.importance ?? 50,
      recencyScore: calculateRecencyScore(repo.updatedAt),
      credibilityScore: 50,
      visualWeight: 3,
      status: (override?.status ?? repo.status) as any,
      updatedAt: repo.updatedAt,
      source: 'github',
      sourceUrl: repo.sourceUrl,
      featured: override?.featured ?? false,
      modeVisibility: (override?.modeVisibility ?? ['full-brain']) as any,
      cluster: override?.cluster,
      github: repo.github,
    };

    nodes.set(repo.slug, node);
  }

  // Add/merge context docs (higher priority than GitHub)
  for (const doc of contextDocs) {
    const existing = nodes.get(doc.slug);
    if (existing) {
      // Merge: context doc takes priority
      nodes.set(doc.slug, {
        ...existing,
        ...doc,
        // Keep GitHub data
        github: existing.github,
        sourceUrl: existing.sourceUrl ?? doc.sourceUrl,
      });
    } else {
      nodes.set(doc.slug, doc);
    }
  }

  // Add manual-only overrides (projects not from GitHub)
  for (const [slug, override] of overrides) {
    if (!nodes.has(slug)) {
      nodes.set(slug, {
        id: `manual:${slug}`,
        slug,
        type: 'project',
        title: override.title ?? slug,
        summary: override.summary ?? '',
        description: override.description,
        tags: override.tags ?? [],
        domains: override.domains ?? [],
        importance: override.importance ?? 50,
        recencyScore: 50,
        credibilityScore: 70,
        visualWeight: 3,
        status: (override.status ?? 'active') as any,
        source: 'manual',
        featured: override.featured ?? false,
        modeVisibility: (override.modeVisibility ?? ['full-brain']) as any,
        cluster: override.cluster,
      } as NeuralNode);
    }
  }

  // Add publications
  for (const pub of publications) {
    const node: NeuralNode = {
      id: pub.id,
      slug: pub.id.replace('pub:', ''),
      type: 'publication',
      title: pub.title,
      tags: pub.tags,
      domains: pub.domains,
      importance: pub.importance,
      recencyScore: calculateRecencyScore(`${pub.year}-01-01`),
      credibilityScore: 90,
      visualWeight: 5,
      status: 'complete',
      source: 'manual',
      featured: true,
      modeVisibility: pub.modeVisibility as any,
      publication: {
        authors: pub.authors,
        venue: pub.venue,
        year: pub.year,
        doi: pub.doi,
        pmid: pub.pmid,
        pmcid: pub.pmcid,
      },
    } as NeuralNode;

    nodes.set(node.slug, node);
  }

  // Compute final importance and visual weight
  const result: NeuralNode[] = [];
  for (const node of nodes.values()) {
    const computedImportance = computeNodeImportance(node);
    result.push({
      ...node,
      computedImportance,
      visualWeight: getVisualWeight(computedImportance),
    });
  }

  return result;
}

function calculateRecencyScore(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const monthsAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsAgo <= 3) return 100;
  if (monthsAgo <= 6) return 85;
  if (monthsAgo <= 12) return 70;
  if (monthsAgo <= 24) return 55;
  if (monthsAgo <= 48) return 40;
  return 25;
}

function generateEdges(nodes: NeuralNode[]): NeuralEdge[] {
  const edges: NeuralEdge[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.slug, n]));

  // Create edges based on shared tags
  for (const node of nodes) {
    for (const tag of node.tags) {
      // Find other nodes with this tag
      for (const other of nodes) {
        if (node.slug === other.slug) continue;
        if (other.tags.includes(tag)) {
          const edgeId = `${node.slug}-${other.slug}-${tag}`;
          const reverseId = `${other.slug}-${node.slug}-${tag}`;

          // Avoid duplicates
          if (!edges.some((e) => e.id === edgeId || e.id === reverseId)) {
            edges.push({
              id: edgeId,
              source: node.slug,
              target: other.slug,
              relation: 'connected-to',
              weight: 3,
              label: tag,
            });
          }
        }
      }
    }

    // Create edges based on shared cluster
    if (node.cluster) {
      for (const other of nodes) {
        if (node.slug === other.slug) continue;
        if (other.cluster === node.cluster) {
          const edgeId = `cluster:${node.slug}-${other.slug}`;
          const reverseId = `cluster:${other.slug}-${node.slug}`;

          if (!edges.some((e) => e.id === edgeId || e.id === reverseId)) {
            edges.push({
              id: edgeId,
              source: node.slug,
              target: other.slug,
              relation: 'belongs-to',
              weight: 5,
            });
          }
        }
      }
    }
  }

  // Dedupe and limit edges
  const uniqueEdges = new Map<string, NeuralEdge>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('-');
    const existing = uniqueEdges.get(key);
    if (!existing || edge.weight > existing.weight) {
      uniqueEdges.set(key, edge);
    }
  }

  return [...uniqueEdges.values()];
}

async function main() {
  console.log('Building neural graph...\n');

  // Load all data sources
  const [githubRepos, overrides, publications, contextDocs] = await Promise.all([
    loadGitHubRepos(),
    loadManualOverrides(),
    loadPublications(),
    loadContextDocs(),
  ]);

  console.log(`Loaded:`);
  console.log(`  - ${githubRepos.length} GitHub repos`);
  console.log(`  - ${overrides.size} manual overrides`);
  console.log(`  - ${publications.length} publications`);
  console.log(`  - ${contextDocs.length} context docs`);

  // Merge and process
  const nodes = mergeNodes(githubRepos, overrides, contextDocs, publications);
  const edges = generateEdges(nodes);

  console.log(`\nGenerated:`);
  console.log(`  - ${nodes.length} nodes`);
  console.log(`  - ${edges.length} edges`);

  // Sort by importance
  nodes.sort((a, b) => (b.computedImportance ?? 0) - (a.computedImportance ?? 0));

  // Build graph
  const graph: NeuralGraph = {
    nodes,
    edges,
    metadata: {
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      version: '1.0.0',
    },
  };

  // Ensure output directory exists
  const outputDir = path.join(DATA_DIR, 'generated');
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Write output
  const outputPath = path.join(outputDir, 'neural-graph.json');
  await writeFile(outputPath, JSON.stringify(graph, null, 2));

  console.log(`\nWrote graph to ${outputPath}`);

  // Top nodes summary
  console.log('\nTop 10 nodes by importance:');
  nodes.slice(0, 10).forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.title} (${n.computedImportance})`);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
