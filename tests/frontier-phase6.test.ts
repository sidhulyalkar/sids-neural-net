import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierForagedSourceRetentionScore,
  retainFrontierForagedSources,
  type FrontierForagedSource,
} from '../lib/frontier/forage/sourceRoster';
import {
  evaluateFrontierForageCandidates,
  extractFrontierSourceGraph,
  type FrontierForageCandidate,
} from '../lib/frontier/forage/sourceForager';
import {
  bestFrontierWatchMatch,
  normalizedWatchIntentScore,
  type FrontierWatchIntent,
} from '../lib/frontier/watch/intentEngine';
import {
  parseFrontierPaletteCommand,
  resolveFrontierPaletteKeyboardIntent,
} from '../lib/frontier/watch/commandPalette';

const NOW = Date.UTC(2026, 7, 22, 19, 30, 0);

function source(id: number, overrides: Partial<FrontierForagedSource> = {}): FrontierForagedSource {
  return {
    id: `source-${id}`,
    endpoint: `https://source${id}.example/feed.xml`,
    domain: `source${id}.example`,
    label: `Source ${id}`,
    contextText: `technical source ${id}`,
    semanticSimilarity: 0.7,
    credibility: 0.8,
    evidence: ['alternate-feed'],
    active: true,
    discoveredAt: NOW - id * 60_000,
    updatedAt: NOW - id * 60_000,
    lastPolledAt: NOW - id * 60_000,
    lastUsefulAt: NOW - id * 60_000,
    totalPolls: 10,
    totalDiscovered: 50,
    totalUnseen: 20,
    yieldQuality: 0.4,
    consecutiveFailures: 0,
    ...overrides,
  };
}

function unit(dimension: number, index: number): Float32Array {
  const vector = new Float32Array(dimension);
  vector[index] = 1;
  return vector;
}

test('autonomous source roster keeps high-yield value over shallow recency and caps at 50', () => {
  const records = Array.from({ length: 52 }, (_, index) => source(index));
  records[50] = source(50, {
    id: 'valuable-old-source',
    endpoint: 'https://valuable.example/feed.xml',
    domain: 'valuable.example',
    yieldQuality: 0.96,
    semanticSimilarity: 0.93,
    credibility: 0.95,
    lastPolledAt: NOW - 21 * 86_400_000,
    lastUsefulAt: NOW - 9 * 86_400_000,
  });
  records[51] = source(51, {
    id: 'recent-but-empty',
    endpoint: 'https://empty.example/feed.xml',
    domain: 'empty.example',
    yieldQuality: 0.01,
    semanticSimilarity: 0.59,
    credibility: 0.73,
    lastPolledAt: NOW - 1_000,
    lastUsefulAt: 0,
    consecutiveFailures: 4,
  });

  const kept = retainFrontierForagedSources(records, 50, NOW);
  assert.equal(kept.length, 50);
  assert.ok(kept.some((entry) => entry.id === 'valuable-old-source'));
  assert.ok(!kept.some((entry) => entry.id === 'recent-but-empty'));
  assert.ok(frontierForagedSourceRetentionScore(records[50], NOW) > frontierForagedSourceRetentionScore(records[51], NOW));
});

test('Watch Intent interruption requires semantic threshold plus novelty and credibility', () => {
  const intent: FrontierWatchIntent = {
    id: 'watch-state-space',
    label: 'state-space neural models',
    vector: unit(384, 0),
    embeddingBackend: 'feature-hash',
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const exact = bestFrontierWatchMatch({ novelty: 0.96, quality: 0.92 }, unit(384, 0), [intent]);
  assert.equal(exact?.score, 1);
  assert.equal(exact?.highPriority, true);

  const belowThreshold = new Float32Array(384);
  belowThreshold[0] = 0.8;
  belowThreshold[1] = 0.6;
  assert.ok(normalizedWatchIntentScore(belowThreshold, intent.vector) < 0.92);
  assert.equal(bestFrontierWatchMatch({ novelty: 0.96, quality: 0.92 }, belowThreshold, [intent])?.highPriority, false);

  assert.equal(bestFrontierWatchMatch({ novelty: 0.5, quality: 0.92 }, unit(384, 0), [intent])?.highPriority, false);
  assert.equal(bestFrontierWatchMatch({ novelty: 0.96, quality: 0.4 }, unit(384, 0), [intent])?.highPriority, false);
});

test('command palette parses watch commands and restores focus on close shortcuts', () => {
  assert.deepEqual(parseFrontierPaletteCommand('  Watch:   13kb physics engines  '), {
    kind: 'watch',
    query: '13kb physics engines',
  });
  assert.deepEqual(parseFrontierPaletteCommand('Unwatch: state-space models'), {
    kind: 'unwatch',
    query: 'state-space models',
  });
  assert.equal(resolveFrontierPaletteKeyboardIntent({ open: false, key: 'k', metaKey: true }), 'open-focus-input');
  assert.equal(resolveFrontierPaletteKeyboardIntent({ open: true, key: 'k', ctrlKey: true }), 'close-restore-focus');
  assert.equal(resolveFrontierPaletteKeyboardIntent({ open: true, key: 'Escape' }), 'close-restore-focus');
  assert.equal(resolveFrontierPaletteKeyboardIntent({ open: true, key: 'x' }), 'none');
});

test('source graph extracts real alternate feeds and bounded technical outbound evidence', () => {
  const parsed = extractFrontierSourceGraph(`
    <html><head>
      <title>Continuous neural systems</title>
      <meta name="description" content="State-space neuroscience and array storage">
      <link rel="alternate" type="application/rss+xml" title="Lab notes" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="http://insecure.example/atom.xml">
    </head><body>
      <h1>Research notes</h1>
      <a href="https://github.com/example/neural-zarr">code repository</a>
      <a href="https://doi.org/10.1234/example">paper citation</a>
      <a href="https://localhost/private">RSS feed</a>
      <a href="javascript:alert(1)">bad link</a>
    </body></html>
  `, 'https://lab.example/articles/state-space');

  assert.equal(parsed.feeds.length, 1);
  assert.equal(parsed.feeds[0].url, 'https://lab.example/feed.xml');
  assert.ok(parsed.feeds[0].credibility >= 0.8);
  assert.ok(parsed.domains.some((candidate) => candidate.domain === 'github.com' && candidate.evidence.includes('github')));
  assert.ok(parsed.domains.some((candidate) => candidate.domain === 'doi.org' && candidate.evidence.includes('citation')));
  assert.ok(!parsed.feeds.some((candidate) => candidate.url.startsWith('http://')));
  assert.ok(!parsed.domains.some((candidate) => candidate.domain === 'localhost'));
});

test('source promotion requires a credible feed aligned to the active 64D state', () => {
  const candidates: FrontierForageCandidate[] = [
    {
      id: 'aligned',
      kind: 'feed',
      url: 'https://aligned.example/feed.xml',
      domain: 'aligned.example',
      label: 'Aligned feed',
      contextText: 'state-space neural models',
      credibility: 0.9,
      evidence: ['alternate-feed'],
    },
    {
      id: 'orthogonal',
      kind: 'feed',
      url: 'https://orthogonal.example/feed.xml',
      domain: 'orthogonal.example',
      label: 'Orthogonal feed',
      contextText: 'unrelated topic',
      credibility: 0.9,
      evidence: ['alternate-feed'],
    },
    {
      id: 'weak',
      kind: 'domain',
      url: 'https://weak.example/',
      domain: 'weak.example',
      label: 'Weak domain',
      contextText: 'state-space neural models',
      credibility: 0.5,
      evidence: ['outbound'],
    },
  ];
  const vectors = new Map<string, Float32Array>([
    ['aligned', unit(64, 0)],
    ['orthogonal', unit(64, 1)],
    ['weak', unit(64, 0)],
  ]);
  const evaluated = evaluateFrontierForageCandidates(candidates, vectors, unit(64, 0));
  const byId = new Map(evaluated.map((entry) => [entry.candidate.id, entry]));
  assert.equal(byId.get('aligned')?.accepted, true);
  assert.equal(byId.get('orthogonal')?.accepted, false);
  assert.equal(byId.get('weak')?.accepted, false);
});
