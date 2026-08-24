import type { FrontierItem, FrontierMedia } from '../types';

const GITHUB_HOST = 'github.com';
const GITHUB_PREVIEW_HOST = 'opengraph.githubassets.com';
const HUGGING_FACE_HOST = 'huggingface.co';
const HUGGING_FACE_PAPER_THUMBNAIL_HOST = 'cdn-thumbnails.huggingface.co';

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

export function frontierHuggingFacePaperId(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== HUGGING_FACE_HOST) return undefined;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'papers' || !parts[1]) return undefined;
    const id = decodeURIComponent(parts[1]).replace(/v\d+$/i, '');
    return /^\d{4}\.\d{4,5}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function frontierHuggingFacePaperPreview(rawUrl: string, title?: string): FrontierMedia | undefined {
  const paperId = frontierHuggingFacePaperId(rawUrl);
  if (!paperId) return undefined;
  return {
    type: 'image',
    url: `https://${HUGGING_FACE_PAPER_THUMBNAIL_HOST}/social-thumbnails/papers/${paperId}.png`,
    alt: title ? `${title} paper preview` : `Hugging Face paper ${paperId} preview`,
    aspectRatio: 'wide',
  };
}

/**
 * Source visuals are evidence-bearing presentation metadata only. They never
 * alter relevance scores or preference state, and they are always derived
 * from canonical source identity rather than synthesized editorial art.
 */
export function enrichFrontierSourceVisual(item: FrontierItem): FrontierItem {
  if (item.sourceKind === 'github') {
    const media = frontierGithubSocialPreview(item.url);
    return media ? { ...item, media } : item;
  }

  if (item.sourceKind === 'huggingface' && (!item.media || item.media.type === 'none')) {
    const media = frontierHuggingFacePaperPreview(item.url, item.title);
    return media ? { ...item, media } : item;
  }

  return item;
}
