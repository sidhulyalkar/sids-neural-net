import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierTrajectoryContextForLane,
  frontierTrajectoryTarget,
  type FrontierTrajectoryMap,
} from '../lib/frontier/trajectory/contextTrajectories';
import { bestFrontierAvoidMatch, FRONTIER_AVOID_MAX_PENALTY, type FrontierAvoidAnchor } from '../lib/frontier/watch/avoidEngine';
import { parseFrontierPaletteCommand } from '../lib/frontier/watch/commandPalette';
import {
  frontierRollingSourceYield,
  shouldEvictFrontierForagedSource,
  type FrontierForagedSource,
} from '../lib/frontier/forage/sourceRoster';
import { collapseFrontierConvergence } from '../lib/frontier/synthesis/convergence';
import { extractFrontierArtifacts } from '../lib/frontier/synthesis/artifactExtractor';
import { resolveFrontierFocalKeyboardIntent } from '../lib/frontier/synthesis/focalPlane';
import {
  scoreFrontierVelocityNeighborhood,
  type FrontierVelocityObservation,
} from '../lib/frontier/synthesis/velocityEngine';
import { resolveFrontierReadingDensity } from '../components/frontier/useAdaptiveReadingDensity';
import { normalizeVector } from '../lib/frontier/vector/math';
import { hybridFrontierScores } from '../lib/frontier/vector/ranker';
import { projectEmbeddingToSequence } from '../lib/frontier/vector/sequenceModel';
import type { FrontierItem, FrontierSourceKind } from '../lib/frontier/types';

function axis(dimension: number, index: number): Float32Array {
  const vector = new Float32Array(dimension);
  vector[index] = 1;
  return vector;
}

function item(id: string, sourceKind: FrontierSourceKind, lane: FrontierItem['lane'] = 'ai_frontier'): FrontierItem {
  return {
    id,
    title: `State space model ${id}`,
    summary: 'A new state space neural model improves benchmark accuracy to 92.4% with open source code.',
    url: `https://${id}.example.org/story`,
    source: `${id}.example.org`,
    sourceLabel: id,
    sourceKind,
    publishedAt: '2026-08-22T18:00:00.000Z',
    lane,
    tags: ['state space models', 'neural sequence model'],
    baseScore: 0.8,
    importance: 0.78,
    novelty: 0.82,
    quality: 0.86,
    momentum: 0.72,
  };
}

test('parallel trajectories route fixed domains without cross-contaminating fast targets', () => {
  assert.equal(frontierTrajectoryContextForLane('ai_frontier'), 'research');
  assert.equal(frontierTrajectoryContextForLane('competitions'), 'algorithms');
  assert.equal(frontierTrajectoryContextForLane('sports'), 'outdoor-motion');
  assert.equal(frontierTrajectoryContextForLane('music'), 'music');

  const fallback = axis(384, 9);
  const researchTarget = axis(384, 3);
  const outdoorTarget = axis(384, 12);
  const trajectories: FrontierTrajectoryMap = {
    research: { context: 'research', state: axis(64, 1), target: researchTarget, updatedAt: 1000, interactions: 4 },
    'outdoor-motion': { context: 'outdoor-motion', state: axis(64, 7), target: outdoorTarget, updatedAt: 1000, interactions: 7 },
  };
  const research = frontierTrajectoryTarget({ lane: 'ai_frontier' }, trajectories, fallback, 1100);
  const outdoor = frontierTrajectoryTarget({ lane: 'sports' }, trajectories, fallback, 1100);
  assert.equal(research?.[3], 1);
  assert.equal(research?.[12], 0);
  assert.equal(outdoor?.[12], 1);
  assert.equal(outdoor?.[3], 0);
});

test('young context trajectories blend with global fallback before becoming authoritative', () => {
  const local = axis(384, 2);
  const fallback = axis(384, 5);
  const trajectories: FrontierTrajectoryMap = {
    research: { context: 'research', state: axis(64, 2), target: local, updatedAt: 1000, interactions: 1 },
  };
  const resolved = frontierTrajectoryTarget({ lane: 'ai_frontier' }, trajectories, fallback, 1100)!;
  assert.ok(resolved[2] > resolved[5]);
  assert.ok(resolved[5] > 0);
});

test('Avoid anchors are explicit bounded penalties and palette grammar is reversible', () => {
  const vector = axis(384, 4);
  const anchor: FrontierAvoidAnchor = {
    id: 'avoid-hype',
    label: 'generic AI hype',
    vector,
    embeddingBackend: 'feature-hash',
    active: true,
    createdAt: 1,
    updatedAt: 1,
  };
  const aligned = bestFrontierAvoidMatch(vector, [anchor]);
  assert.ok(aligned);
  assert.equal(aligned?.penalty, FRONTIER_AVOID_MAX_PENALTY);
  assert.equal(bestFrontierAvoidMatch(axis(384, 11), [anchor]), undefined);
  assert.deepEqual(parseFrontierPaletteCommand('Avoid: generic AI hype'), { kind: 'avoid', query: 'generic AI hype' });
  assert.deepEqual(parseFrontierPaletteCommand('Allow: generic AI hype'), { kind: 'unavoid', query: 'generic AI hype' });
});

test('hybrid ranker subtracts Avoid penalties without mutating positive semantic score', () => {
  const candidate = item('one', 'arxiv');
  const vector = axis(384, 0);
  const vectors = new Map([[candidate.id, vector]]);
  const now = Date.now();
  const clean = hybridFrontierScores([candidate], vectors, vector, '', now)[0];
  const suppressed = hybridFrontierScores([candidate], vectors, vector, '', now, undefined, () => 0.3)[0];
  assert.equal(clean.semantic, suppressed.semantic);
  assert.ok(Math.abs((clean.score - suppressed.score) - 0.3) < 1e-9);
});

function source(overrides: Partial<FrontierForagedSource> = {}): FrontierForagedSource {
  return {
    id: 'feed-1', endpoint: 'https://example.org/feed.xml', domain: 'example.org', label: 'example', contextText: 'ai systems',
    semanticSimilarity: 0.82, credibility: 0.88, evidence: ['feed-link'], active: true,
    discoveredAt: Date.UTC(2026, 7, 1), updatedAt: Date.UTC(2026, 7, 22), lastPolledAt: Date.UTC(2026, 7, 22), lastUsefulAt: Date.UTC(2026, 7, 12),
    totalPolls: 20, totalDiscovered: 100, totalUnseen: 3, yieldQuality: 0.2, consecutiveFailures: 0,
    ...overrides,
  };
}

test('14-day learned-source window evicts persistent low-alignment noise but retains productive sources', () => {
  const now = Date.UTC(2026, 7, 22, 20);
  const low = source({
    yield14d: [
      { day: '2026-08-20', polls: 5, discovered: 10, unseen: 0, aligned: 0, failures: 0 },
      { day: '2026-08-21', polls: 5, discovered: 10, unseen: 0, aligned: 0, failures: 0 },
    ],
  });
  const productive = source({
    yieldQuality: 0.55,
    yield14d: [
      { day: '2026-08-20', polls: 5, discovered: 10, unseen: 4, aligned: 5, failures: 0 },
      { day: '2026-08-21', polls: 5, discovered: 10, unseen: 3, aligned: 4, failures: 0 },
    ],
  });
  assert.equal(shouldEvictFrontierForagedSource(low, now), true);
  assert.equal(shouldEvictFrontierForagedSource(productive, now), false);
  assert.ok(frontierRollingSourceYield(productive, now).alignedRate > 0.4);
});

test('convergence collapses three diverse semantically aligned sources but not a two-source echo', () => {
  const a = item('paper', 'arxiv');
  const b = { ...item('repo', 'github'), title: 'State space model implementation' };
  const c = { ...item('blog', 'rss'), title: 'State space neural model analysis' };
  const vectors = new Map<string, Float32Array>([
    [a.id, normalizeVector(Float32Array.from([1, 0.02, 0]))],
    [b.id, normalizeVector(Float32Array.from([0.99, 0.04, 0]))],
    [c.id, normalizeVector(Float32Array.from([0.98, 0.03, 0.01]))],
  ]);
  const collapsed = collapseFrontierConvergence([a, b, c], vectors);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].convergence?.members.length, 3);
  assert.equal(collapseFrontierConvergence([a, b], vectors).length, 2);
});

test('artifact extraction only surfaces grounded metrics repositories and formulas', () => {
  const candidate = {
    ...item('repo', 'github'),
    url: 'https://github.com/acme/state-space/releases/tag/v2.0',
    summary: 'The update reports y[k] = Cx[k] and achieves 92.4% AUC on the benchmark.',
    metrics: [{ label: 'AUC', value: '0.924' }],
  };
  const artifacts = extractFrontierArtifacts(candidate);
  assert.ok(artifacts.some((artifact) => artifact.kind === 'release' && artifact.url === candidate.url));
  assert.ok(artifacts.some((artifact) => artifact.kind === 'benchmark' && artifact.value === '0.924'));
  assert.ok(artifacts.some((artifact) => artifact.kind === 'formula' && artifact.value?.includes('=')));
});

test('semantic velocity requires cross-source acceleration rather than one-source volume', () => {
  const candidate = item('current', 'arxiv');
  const itemVector = axis(384, 0);
  const projected = projectEmbeddingToSequence(itemVector).buffer as ArrayBuffer;
  const now = Date.UTC(2026, 7, 22, 20);
  const observations: FrontierVelocityObservation[] = [
    { id: '1', at: now - 10_000, sourceLabel: 'arxiv', title: 'a', vector: projected.slice(0) },
    { id: '2', at: now - 20_000, sourceLabel: 'github', title: 'b', vector: projected.slice(0) },
    { id: '3', at: now - 30_000, sourceLabel: 'blog', title: 'c', vector: projected.slice(0) },
    { id: '4', at: now - 40_000, sourceLabel: 'forum', title: 'd', vector: projected.slice(0) },
  ];
  assert.ok(scoreFrontierVelocityNeighborhood(candidate, itemVector, observations, now));
  assert.equal(
    scoreFrontierVelocityNeighborhood(candidate, itemVector, observations.map((entry) => ({ ...entry, sourceLabel: 'one-source' })), now),
    undefined
  );
});

test('adaptive density and focal shortcut preserve reading/interaction intent', () => {
  assert.equal(resolveFrontierReadingDensity({ speed: 1.2, previous: 'balanced', deepUntil: 0, now: 10 }), 'scan');
  assert.equal(resolveFrontierReadingDensity({ speed: 0.1, previous: 'balanced', deepUntil: 100, now: 10 }), 'deep');
  assert.equal(resolveFrontierReadingDensity({ speed: 1.8, previous: 'deep', deepUntil: 100, now: 10 }), 'scan');
  assert.equal(resolveFrontierFocalKeyboardIntent({ key: ' ', open: false, hasHoveredItem: true, typing: false }), 'open');
  assert.equal(resolveFrontierFocalKeyboardIntent({ key: ' ', open: false, hasHoveredItem: true, typing: true }), 'none');
  assert.equal(resolveFrontierFocalKeyboardIntent({ key: 'Escape', open: true, hasHoveredItem: false, typing: false }), 'close');
});
