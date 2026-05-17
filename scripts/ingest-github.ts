/**
 * GitHub Repository Ingestion Script
 *
 * Fetches all public repositories for sidhulyalkar and converts them
 * to NeuralNode format for the graph builder.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const username = process.env.NEXT_PUBLIC_GITHUB_USERNAME ?? 'sidhulyalkar';
const token = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
  };
  license: {
    name: string;
  } | null;
}

interface NormalizedRepo {
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

async function fetchAllRepos(): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  console.log(`Fetching repositories for ${username}...`);

  while (true) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`;
    console.log(`  Fetching page ${page}...`);

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    repos.push(...data);
    page++;

    // Respect rate limiting
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining && parseInt(remaining) < 10) {
      console.log('  Rate limit approaching, waiting...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`  Found ${repos.length} repositories`);
  return repos;
}

function inferTags(repo: GitHubRepo): string[] {
  const text =
    `${repo.name} ${repo.description ?? ''} ${repo.topics.join(' ')}`.toLowerCase();
  const tags = new Set<string>();

  // DataJoint ecosystem
  if (text.includes('datajoint') || text.includes('element-')) {
    tags.add('DataJoint');
  }

  // Neuroscience
  if (
    text.includes('neuro') ||
    text.includes('brain') ||
    text.includes('eeg') ||
    text.includes('ecog') ||
    text.includes('lfp') ||
    text.includes('spike')
  ) {
    tags.add('Neuroscience');
  }

  // BCI
  if (text.includes('bci') || text.includes('brain-computer')) {
    tags.add('BCI');
  }

  // Mechanistic Interpretability
  if (text.includes('mech') && text.includes('interp')) {
    tags.add('mechanistic-interpretability');
  }

  // Infrastructure/DevOps
  if (text.includes('docker')) tags.add('Docker');
  if (text.includes('aws') || text.includes('terraform') || text.includes('s3')) {
    tags.add('Cloud');
    tags.add('AWS');
  }
  if (text.includes('kubernetes') || text.includes('k8s')) tags.add('Kubernetes');

  // ML/AI
  if (text.includes('transformer') || text.includes('attention')) {
    tags.add('Transformers');
  }
  if (text.includes('deep') && text.includes('learn')) tags.add('Deep Learning');
  if (text.includes('classifier') || text.includes('classification')) {
    tags.add('Classification');
  }

  // Personal
  if (text.includes('pet') || text.includes('woof') || text.includes('shasta')) {
    tags.add('Shasta-inspired');
    tags.add('Personal');
  }

  // Language tags
  if (repo.language) {
    tags.add(repo.language);
  }

  // Topics from GitHub
  repo.topics.forEach((topic) => {
    if (topic.length > 2) {
      tags.add(topic);
    }
  });

  return [...tags];
}

function inferDomains(repo: GitHubRepo, tags: string[]): string[] {
  const domains = new Set<string>();

  if (tags.includes('DataJoint')) {
    domains.add('Neural Data Infrastructure');
  }
  if (tags.includes('BCI')) {
    domains.add('BCI & Real-Time Systems');
  }
  if (tags.includes('mechanistic-interpretability')) {
    domains.add('Mechanistic Interpretability');
  }
  if (tags.includes('Cloud') || tags.includes('Docker')) {
    domains.add('Cloud Infrastructure');
  }
  if (tags.includes('Shasta-inspired') || tags.includes('Personal')) {
    domains.add('Personal Product Experiments');
  }
  if (tags.includes('Neuroscience') && !domains.has('Neural Data Infrastructure')) {
    domains.add('Neuroscience Research');
  }

  return [...domains];
}

function normalizeRepo(repo: GitHubRepo): NormalizedRepo {
  const tags = inferTags(repo);
  const domains = inferDomains(repo, tags);

  return {
    id: `github:${repo.full_name}`,
    slug: repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: 'project',
    title: repo.name,
    summary: repo.description ?? '',
    source: 'github',
    sourceUrl: repo.html_url,
    tags,
    domains,
    status: repo.archived ? 'archived' : 'active',
    updatedAt: repo.updated_at,
    createdAt: repo.created_at,
    github: {
      owner: repo.owner.login,
      repo: repo.name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      isFork: repo.fork,
      pushedAt: repo.pushed_at,
      createdAt: repo.created_at,
      topics: repo.topics,
      description: repo.description,
      url: repo.html_url,
    },
  };
}

async function main() {
  try {
    const repos = await fetchAllRepos();
    const normalized = repos.map(normalizeRepo);

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'data', 'generated');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Write output
    const outputPath = path.join(outputDir, 'github-repos.json');
    await writeFile(outputPath, JSON.stringify(normalized, null, 2));

    console.log(`\nWrote ${normalized.length} repos to ${outputPath}`);

    // Summary stats
    const forks = normalized.filter((r) => r.github.isFork).length;
    const archived = normalized.filter((r) => r.status === 'archived').length;
    const withStars = normalized.filter((r) => r.github.stars > 0).length;

    console.log(`  - ${forks} forks`);
    console.log(`  - ${archived} archived`);
    console.log(`  - ${withStars} with stars`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
