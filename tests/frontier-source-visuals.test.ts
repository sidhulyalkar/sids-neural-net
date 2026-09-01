import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichFrontierSourceVisual,
  frontierGithubRepositoryParts,
  frontierGithubSocialPreview,
  frontierHuggingFacePaperId,
  frontierHuggingFacePaperPreview,
  isFrontierGithubSocialPreview,
} from '../lib/frontier/media/sourceVisuals';
import type { FrontierItem } from '../lib/frontier/types';

function githubItem(url = 'https://github.com/openai/openai-node'): FrontierItem {
  return {
    id: 'gh-test',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    title: 'openai/openai-node',
    summary: 'Repository',
    url,
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'builder_signal',
    tags: ['code'],
    baseScore: 0.8,
    importance: 0.7,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.6,
  };
}

test('GitHub repository parser accepts canonical repositories and strips .git', () => {
  assert.deepEqual(frontierGithubRepositoryParts('https://github.com/openai/openai-node'), { owner: 'openai', repo: 'openai-node' });
  assert.deepEqual(frontierGithubRepositoryParts('https://github.com/openai/openai-node.git'), { owner: 'openai', repo: 'openai-node' });
  assert.equal(frontierGithubRepositoryParts('https://example.com/openai/openai-node'), undefined);
});

test('GitHub preview is an authentic githubassets image derived from canonical identity', () => {
  const media = frontierGithubSocialPreview('https://github.com/openai/openai-node');
  assert.equal(media?.type, 'image');
  assert.equal(media?.url, 'https://opengraph.githubassets.com/frontier/openai/openai-node');
  assert.equal(isFrontierGithubSocialPreview(media?.url), true);
});

test('GitHub source enrichment replaces weak avatars with repository-level preview only', () => {
  const original = githubItem();
  original.media = { type: 'image', url: 'https://avatars.githubusercontent.com/u/1?v=4', alt: 'owner avatar' };
  const enriched = enrichFrontierSourceVisual(original);
  assert.equal(enriched.media?.url, 'https://opengraph.githubassets.com/frontier/openai/openai-node');
  assert.equal(original.media.url?.includes('avatars.githubusercontent.com'), true);
});

test('Hugging Face paper identity derives the official social thumbnail without a fetch', () => {
  assert.equal(frontierHuggingFacePaperId('https://huggingface.co/papers/2608.12345'), '2608.12345');
  assert.equal(frontierHuggingFacePaperId('https://huggingface.co/papers/2608.12345v2'), '2608.12345');
  assert.equal(frontierHuggingFacePaperId('https://example.com/papers/2608.12345'), undefined);

  const media = frontierHuggingFacePaperPreview('https://huggingface.co/papers/2608.12345', 'A paper');
  assert.equal(media?.type, 'image');
  assert.equal(media?.url, 'https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/2608.12345.png');
  assert.equal(media?.aspectRatio, 'wide');
});

test('Hugging Face enrichment is presentation-only and preserves recommendation evidence', () => {
  const original: FrontierItem = {
    ...githubItem('https://huggingface.co/papers/2608.12345'),
    id: 'hf-test',
    source: 'huggingface.co',
    sourceLabel: 'HF Daily Papers',
    sourceKind: 'huggingface',
    title: 'A high-signal paper',
  };
  const enriched = enrichFrontierSourceVisual(original);
  assert.equal(enriched.media?.url, 'https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/2608.12345.png');
  assert.equal(enriched.baseScore, original.baseScore);
  assert.equal(enriched.importance, original.importance);
  assert.equal(enriched.novelty, original.novelty);
  assert.equal(enriched.quality, original.quality);
  assert.equal(enriched.momentum, original.momentum);
});

test('existing real Hugging Face media is never overwritten by derived presentation media', () => {
  const original: FrontierItem = {
    ...githubItem('https://huggingface.co/papers/2608.12345'),
    id: 'hf-real-media',
    sourceKind: 'huggingface',
    media: { type: 'image', url: 'https://example.com/source-carried.png', alt: 'source image' },
  };
  assert.equal(enrichFrontierSourceVisual(original), original);
});

test('other source visuals are untouched', () => {
  const item = { ...githubItem('https://example.com/story'), sourceKind: 'rss' as const };
  assert.equal(enrichFrontierSourceVisual(item), item);
});
