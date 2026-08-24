import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichFrontierSemantics, frontierCandidatePriority } from '../lib/frontier/aggregate';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import { FRONTIER_TOOLING_PROJECTS } from '../lib/frontier/toolingRadarSources';
import type { FrontierItem } from '../lib/frontier/types';

test('established visualization radar explicitly covers Neuroglancer, napari, deck.gl, and Observable Plot', () => {
  assert.deepEqual(
    FRONTIER_TOOLING_PROJECTS.map((project) => project.repo),
    ['google/neuroglancer', 'napari/napari', 'visgl/deck.gl', 'observablehq/plot']
  );
  assert.equal(new Set(FRONTIER_TOOLING_PROJECTS.map((project) => project.repo)).size, 4);
});

test('mature visualization-project updates are admitted and receive semantic candidate priority', () => {
  const raw: FrontierItem = {
    id: 'neuroglancer-release',
    title: 'Neuroglancer · new volume rendering release',
    summary: 'Connectomics viewer improvements for large volumetric datasets.',
    url: 'https://github.com/google/neuroglancer/releases/tag/v1.2.3',
    source: 'github.com',
    sourceLabel: 'google/neuroglancer',
    sourceKind: 'github',
    publishedAt: '2026-08-23T12:00:00.000Z',
    lane: 'neuro_frontier',
    tags: ['scientific software', 'release'],
    baseScore: 0.7,
    importance: 0.76,
    novelty: 0.65,
    quality: 0.84,
    momentum: 0.58,
  };
  const enriched = enrichFrontierSemantics(raw);
  assert.ok(enriched.tags.includes('neuroglancer'));
  assert.ok(enriched.tags.includes('scientific visualization'));
  assert.equal(isFrontierSourceAdmitted(enriched), true);
  assert.ok(frontierCandidatePriority(enriched) > raw.baseScore);
});
