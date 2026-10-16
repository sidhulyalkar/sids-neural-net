import type { FrontierFeedResponse, FrontierItem, FrontierLaneId, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-tooling-radar/1.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 2_200;

type ToolingProject = {
  id: string;
  label: string;
  repo: string;
  lane: FrontierLaneId;
  tags: readonly string[];
  importance: number;
};

/**
 * Established tools get their own curated radar because "trending repositories"
 * systematically favors newly-created projects and misses meaningful releases
 * from mature software the owner already values. This list intentionally spans
 * visualization, neuroscience data infrastructure, behavior analysis, ephys,
 * neural decoding, and the open NeuroAI ecosystem.
 */
export const FRONTIER_TOOLING_PROJECTS: readonly ToolingProject[] = [
  {
    id: 'neuroglancer',
    label: 'Neuroglancer',
    repo: 'google/neuroglancer',
    lane: 'neuro_frontier',
    tags: ['neuroglancer', 'scientific visualization', 'connectomics', 'volume rendering'],
    importance: 0.78,
  },
  {
    id: 'napari',
    label: 'napari',
    repo: 'napari/napari',
    lane: 'neuro_frontier',
    tags: ['napari', 'scientific visualization', 'microscopy visualization', 'python library'],
    importance: 0.75,
  },
  {
    id: 'datajoint',
    label: 'DataJoint',
    repo: 'datajoint/datajoint-python',
    lane: 'neuro_frontier',
    tags: ['datajoint', 'neuroscience data systems', 'data pipeline', 'scientific software'],
    importance: 0.78,
  },
  {
    id: 'spikeinterface',
    label: 'SpikeInterface',
    repo: 'SpikeInterface/spikeinterface',
    lane: 'neuro_frontier',
    tags: ['spikeinterface', 'electrophysiology', 'spike sorting', 'neuropixels', 'scientific software'],
    importance: 0.78,
  },
  {
    id: 'deeplabcut',
    label: 'DeepLabCut',
    repo: 'DeepLabCut/DeepLabCut',
    lane: 'neuro_frontier',
    tags: ['deeplabcut', 'behavior tracking', 'pose estimation', 'scientific software'],
    importance: 0.76,
  },
  {
    id: 'facemap',
    label: 'Facemap',
    repo: 'MouseLand/facemap',
    lane: 'neuro_frontier',
    tags: ['facemap', 'behavior analysis', 'neural behavior', 'scientific software'],
    importance: 0.75,
  },
  {
    id: 'pynwb',
    label: 'PyNWB',
    repo: 'NeurodataWithoutBorders/pynwb',
    lane: 'neuro_frontier',
    tags: ['nwb', 'pynwb', 'neuroscience data systems', 'data standard', 'scientific software'],
    importance: 0.76,
  },
  {
    id: 'dandi',
    label: 'DANDI CLI',
    repo: 'dandi/dandi-cli',
    lane: 'neuro_frontier',
    tags: ['dandi', 'nwb', 'neuroscience data systems', 'data archive', 'scientific software'],
    importance: 0.74,
  },
  {
    id: 'mne-python',
    label: 'MNE-Python',
    repo: 'mne-tools/mne-python',
    lane: 'neuro_frontier',
    tags: ['mne', 'eeg', 'meg', 'neural decoding', 'scientific software'],
    importance: 0.74,
  },
  {
    id: 'braindecode',
    label: 'Braindecode',
    repo: 'braindecode/braindecode',
    lane: 'neuro_frontier',
    tags: ['braindecode', 'eeg', 'neural decoding', 'bci', 'deep learning'],
    importance: 0.74,
  },
  {
    id: 'neuroai',
    label: 'NeuroAI',
    repo: 'facebookresearch/neuroai',
    lane: 'neuro_frontier',
    tags: ['neuroai', 'neural representation', 'benchmark', 'foundation model', 'open source'],
    importance: 0.76,
  },
  {
    id: 'deck-gl',
    label: 'deck.gl',
    repo: 'visgl/deck.gl',
    lane: 'builder_signal',
    tags: ['deck.gl', 'visualization tools', 'webgl', 'geospatial visualization'],
    importance: 0.66,
  },
  {
    id: 'observable-plot',
    label: 'Observable Plot',
    repo: 'observablehq/plot',
    lane: 'builder_signal',
    tags: ['observable', 'visualization tools', 'data visualization', 'javascript library'],
    importance: 0.66,
  },
] as const;

type GitHubRelease = {
  id?: number;
  tag_name?: string;
  name?: string | null;
  html_url?: string;
  body?: string | null;
  published_at?: string | null;
  created_at?: string;
  prerelease?: boolean;
  draft?: boolean;
};

type GitHubCommit = {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { date?: string };
  };
};

function cleanText(value: string | undefined | null): string {
  return (value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[>#*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(value: string | undefined | null, maxLength = 320): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 190 ? boundary : maxLength).trim()}…`;
}

function ageDays(value: string): number {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / DAY_MS);
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function baseScores(project: ToolingProject, publishedAt: string, release: boolean) {
  const freshness = Math.exp(-ageDays(publishedAt) / 18);
  const quality = 0.84;
  const novelty = release ? 0.67 : 0.56;
  const momentum = release ? 0.58 : 0.45;
  const baseScore = Math.min(1,
    project.importance * 0.3 + quality * 0.25 + freshness * 0.22 + novelty * 0.13 + momentum * 0.1
  );
  return { quality, novelty, momentum, baseScore };
}

function releaseItem(project: ToolingProject, release: GitHubRelease): FrontierItem | undefined {
  if (!release.id || !release.html_url || release.draft) return undefined;
  const publishedAt = release.published_at || release.created_at;
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt)) || ageDays(publishedAt) > 90) return undefined;
  const version = cleanText(release.name) || release.tag_name || 'new release';
  const summary = summarize(release.body) || `${project.label} published ${version}.`;
  return {
    id: `tooling-${project.id}-release-${release.id}`,
    title: `${project.label} · ${version}`,
    summary,
    url: release.html_url,
    source: 'github.com',
    sourceLabel: project.repo,
    sourceKind: 'github',
    publishedAt: new Date(publishedAt).toISOString(),
    lane: project.lane,
    tags: Array.from(new Set([...project.tags, 'scientific software', 'release', release.prerelease ? 'prerelease' : 'stable release'])),
    importance: project.importance,
    ...baseScores(project, publishedAt, true),
    why: `${project.label} is in the established-tool radar, so meaningful releases stay visible even when the repository is too mature to trend.`,
  };
}

function commitItem(project: ToolingProject, entry: GitHubCommit): FrontierItem | undefined {
  const sha = entry.sha;
  const url = entry.html_url;
  const date = entry.commit?.author?.date;
  const message = cleanText(entry.commit?.message).split(/\n+/)[0]?.trim();
  if (!sha || !url || !date || !message || Number.isNaN(Date.parse(date)) || ageDays(date) > 14) return undefined;
  const lower = message.toLowerCase();
  if (/^(merge|bump|chore|deps?|dependabot|pre-commit|ci\b)/.test(lower)) return undefined;
  return {
    id: `tooling-${project.id}-commit-${stableId(sha)}`,
    title: `${project.label} · ${message.slice(0, 150)}`,
    summary: `Recent substantive development in ${project.repo}.`,
    url,
    source: 'github.com',
    sourceLabel: project.repo,
    sourceKind: 'github',
    publishedAt: new Date(date).toISOString(),
    lane: project.lane,
    tags: Array.from(new Set([...project.tags, 'scientific software', 'project update'])),
    importance: project.importance * 0.84,
    ...baseScores(project, date, false),
    why: `${project.label} is an explicitly watched scientific tool; low-information maintenance commits are filtered out.`,
  };
}

async function githubJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const token = process.env.FRONTIER_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

async function projectItems(project: ToolingProject): Promise<FrontierItem[]> {
  let releaseReachable = true;
  let releases: GitHubRelease[] = [];
  try {
    releases = await githubJson<GitHubRelease[]>(`/repos/${project.repo}/releases?per_page=3`);
  } catch {
    releaseReachable = false;
  }

  const releaseItems = releases.flatMap((release) => {
    const parsed = releaseItem(project, release);
    return parsed ? [parsed] : [];
  }).slice(0, 2);
  if (releaseItems.length) return releaseItems;

  // Some excellent scientific tools publish continuously without GitHub
  // Releases. Fall back to a tiny recent-commit view, filtering maintenance.
  let commitReachable = true;
  let commits: GitHubCommit[] = [];
  try {
    commits = await githubJson<GitHubCommit[]>(`/repos/${project.repo}/commits?per_page=6`);
  } catch {
    commitReachable = false;
  }
  if (!releaseReachable && !commitReachable) {
    throw new Error(`GitHub unavailable for ${project.repo}`);
  }

  return commits.flatMap((entry) => {
    const parsed = commitItem(project, entry);
    return parsed ? [parsed] : [];
  }).slice(0, 1);
}

export async function getToolingRadarFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_TOOLING_PROJECTS.map(projectItems));
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const status: FrontierSourceStatus = {
    id: 'github',
    label: 'Scientific tooling radar',
    ok: items.length > 0 || failures < runs.length,
    count: items.length,
    message: failures > 0 && items.length === 0 ? 'scientific tooling radar partially unavailable' : undefined,
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
