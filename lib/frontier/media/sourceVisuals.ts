import type { FrontierItem, FrontierMedia } from '../types';

const GITHUB_HOST = 'github.com';
const GITHUB_PREVIEW_HOST = 'opengraph.githubassets.com';

export function frontierGithubRepositoryParts(rawUrl: string): { owner: string; repo: string } | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.toLowerCase() !== GITHUB_HOST) return undefined;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return undefined;
    const [owner, repo] = parts;
    if (!owner || !repo || owner === 'orgs' || owner === 'settings') return undefined;
    return { owner, repo: repo.replace(/\.git$/i, '') };
  } catch {
    return undefined;
  }
}

export function frontierGithubSocialPreview(rawUrl: string): FrontierMedia | undefined {
  const repository = frontierGithubRepositoryParts(rawUrl);
  if (!repository) return undefined;
  const owner = encodeURIComponent(repository.owner);
  const repo = encodeURIComponent(repository.repo);
  return {
    type: 'image',
    url: `https://${GITHUB_PREVIEW_HOST}/frontier/${owner}/${repo}`,
    alt: `${repository.owner}/${repository.repo} repository preview`,
    aspectRatio: 'wide',
  };
}

export function isFrontierGithubSocialPreview(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === GITHUB_PREVIEW_HOST;
  } catch {
    return false;
  }
}

/**
 * Source visuals are evidence-bearing presentation metadata only. They never
 * alter relevance scores or preference state, and they are always derived
 * from the canonical source itself rather than synthesized editorial art.
 */
export function enrichFrontierSourceVisual(item: FrontierItem): FrontierItem {
  if (item.sourceKind !== 'github') return item;
  const media = frontierGithubSocialPreview(item.url);
  return media ? { ...item, media } : item;
}
