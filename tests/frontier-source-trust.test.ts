import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { rankFrontierItems } from '../lib/frontier/scoring';
import {
  assessFrontierSource,
  isFrontierSourceAdmitted,
  vetFrontierItems,
} from '../lib/frontier/sourceTrust';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'brave_web',
    publishedAt: '2026-08-23T12:00:00.000Z',
    lane: 'ml_data',
    tags: ['source-trust-test'],
    baseScore: 0.72,
    importance: 0.64,
    novelty: 0.62,
    quality: 0.72,
    momentum: 0.58,
    ...overrides,
  };
}

test('aggregators cannot lend their reputation to an unknown destination', () => {
  const unknown = item('hn-unknown', {
    sourceKind: 'hackernews',
    source: 'news.ycombinator.com',
    sourceLabel: 'Hacker News',
    url: 'https://daily-ai-insider.example/astonishing-breakthrough',
  });
  const established = item('hn-nature', {
    sourceKind: 'hackernews',
    source: 'news.ycombinator.com',
    sourceLabel: 'Hacker News',
    url: 'https://www.nature.com/articles/example',
  });

  const unknownTrust = assessFrontierSource(unknown);
  const establishedTrust = assessFrontierSource(established);

  assert.equal(unknownTrust.tier, 'unknown');
  assert.ok(unknownTrust.score < 0.4);
  assert.equal(establishedTrust.tier, 'established');
  assert.ok(establishedTrust.score >= 0.9);
  assert.equal(isFrontierSourceAdmitted(unknown), false);
  assert.equal(isFrontierSourceAdmitted(established), true);
});

test('unknown broad-web publishers are excluded from research and world-pulse lanes', () => {
  const research = item('unknown-research', {
    url: 'https://totally-new-ai-news.example/model-rumor',
    lane: 'ai_frontier',
    sourceKind: 'brave_web',
  });
  const world = item('unknown-world', {
    url: 'https://viral-tech-wire.example/platform-rumor',
    lane: 'world_pulse',
    sourceKind: 'gdelt',
  });

  assert.equal(isFrontierSourceAdmitted(research), false);
  assert.equal(isFrontierSourceAdmitted(world), false);
});

test('established and primary destinations pass strict learn-lane vetting', () => {
  const reuters = item('reuters', {
    url: 'https://www.reuters.com/technology/example',
    lane: 'world_pulse',
    sourceKind: 'brave_web',
  });
  const arxiv = item('arxiv', {
    url: 'https://arxiv.org/abs/2608.12345',
    source: 'arxiv.org',
    sourceLabel: 'arXiv',
    sourceKind: 'arxiv',
    lane: 'ai_frontier',
  });

  assert.equal(isFrontierSourceAdmitted(reuters), true);
  assert.equal(isFrontierSourceAdmitted(arxiv), true);
  assert.ok(assessFrontierSource(arxiv).score >= 0.9);
});

test('syndicated RSS is judged by extracted publisher instead of the aggregator hop', () => {
  const trustedSyndicated = item('google-news-espn', {
    url: 'https://news.google.com/rss/articles/example',
    source: 'espn.com',
    sourceLabel: 'ESPN',
    sourceKind: 'rss',
    lane: 'sports',
  });
  const unprovenSyndicated = item('google-news-unknown', {
    url: 'https://news.google.com/rss/articles/example-2',
    source: 'news.google.com',
    sourceLabel: 'Mystery Sports Wire',
    sourceKind: 'rss',
    lane: 'sports',
  });

  assert.equal(assessFrontierSource(trustedSyndicated).host, 'espn.com');
  assert.equal(isFrontierSourceAdmitted(trustedSyndicated), true);
  assert.equal(assessFrontierSource(unprovenSyndicated).tier, 'unknown');
  assert.equal(isFrontierSourceAdmitted(unprovenSyndicated), false);
});

test('official active-sports bodies are first-class trusted destinations', () => {
  for (const url of [
    'https://www.ifsc-climbing.org/news/example',
    'https://www.uci.org/article/example',
    'https://olympics.com/en/news/example',
    'https://www.crankworx.com/news/example',
  ]) {
    const signal = item(`sport-${url}`, { url, sourceKind: 'gdelt', lane: 'sports' });
    assert.equal(assessFrontierSource(signal).tier, 'primary');
    assert.equal(isFrontierSourceAdmitted(signal), true);
  }
});

test('community sources remain available for fan and culture lanes but cannot become Must Know authority', () => {
  const fanPost = item('fan-post', {
    url: 'https://www.reddit.com/r/Patriots/comments/example/',
    source: 'reddit.com/r/Patriots',
    sourceLabel: 'r/Patriots',
    sourceKind: 'reddit',
    lane: 'team_pulse',
    tags: ['patriots'],
  });
  const assertedAuthority = { ...fanPost, id: 'fan-authority', lane: 'must_know' as const, importance: 0.99 };

  assert.equal(isFrontierSourceAdmitted(fanPost), true);
  assert.equal(isFrontierSourceAdmitted(assertedAuthority), false);
});

test('source trust is a ranking prior among otherwise comparable admitted items', () => {
  const established = item('game-editorial', {
    url: 'https://www.ign.com/articles/example-game-analysis',
    source: 'ign.com',
    sourceLabel: 'IGN',
    sourceKind: 'brave_web',
    lane: 'gaming',
    tags: ['gaming'],
  });
  const creatorVideo = item('game-video', {
    url: 'https://www.youtube.com/watch?v=abc123',
    source: 'youtube.com',
    sourceLabel: 'YouTube',
    sourceKind: 'youtube',
    lane: 'gaming',
    tags: ['gaming'],
  });

  const ranked = rankFrontierItems([creatorVideo, established], createInitialProfile(), {}, new Date('2026-08-23T18:00:00.000Z'));
  assert.deepEqual(ranked.map((entry) => entry.id), ['game-editorial', 'game-video']);
});

test('server-side vetting drops unknown discovery destinations before candidate truncation', () => {
  const trusted = item('trusted', {
    url: 'https://www.reuters.com/technology/example',
    source: 'reuters.com',
    sourceLabel: 'Reuters',
    sourceKind: 'rss',
    lane: 'world_pulse',
    baseScore: 0.62,
    quality: 0.64,
  });
  const suspicious = item('suspicious', {
    url: 'https://breaking-ai-scoops.example/story',
    sourceKind: 'rss',
    lane: 'world_pulse',
    baseScore: 0.99,
    quality: 0.99,
  });

  const vetted = vetFrontierItems([suspicious, trusted]);
  assert.deepEqual(vetted.map((entry) => entry.id), ['trusted']);
  assert.ok(vetted[0].baseScore > trusted.baseScore, 'trusted source should receive a modest candidate-pool prior');
});

test('opaque redirectors cannot enter the recommendation pool', () => {
  const redirected = item('short-link', {
    url: 'https://bit.ly/opaque-story',
    sourceKind: 'brave_web',
    lane: 'gaming',
  });
  assert.ok(assessFrontierSource(redirected).score < 0.2);
  assert.equal(isFrontierSourceAdmitted(redirected), false);
});
