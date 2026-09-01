import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichFrontierSemantics, frontierCandidatePriority } from '../lib/frontier/aggregate';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import { FRONTIER_TOOLING_PROJECTS } from '../lib/frontier/toolingRadarSources';
import type { FrontierItem } from '../lib/frontier/types';

test('scientific tooling radar covers visualization, neuroscience infrastructure, behavior, ephys, and NeuroAI', () => {
  const repos = FRONTIER_TOOLING_PROJECTS.map((project) => project.repo);
  const required = [
    'google/neuroglancer',
    'napari/napari',
    'datajoint/datajoint-python',
    'SpikeInterface/spikeinterface',
    'DeepLabCut/DeepLabCut',
    'MouseLand/facemap',
    'NeurodataWithoutBorders/pynwb',
    'dandi/dandi-cli',
    'mne-tools/mne-python',
    'braindecode/braindecode',
    'facebookresearch/neuroai',
    'visgl/deck.gl',
    'observablehq/plot',
  ];

  for (const repo of required) assert.ok(repos.includes(repo), `missing curated tooling repo ${repo}`);
  assert.equal(new Set(repos).size, repos.length, 'tooling radar repositories must remain unique');
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

test('mature neuroscience infrastructure updates receive the same personal semantic treatment', () => {
  const raw: FrontierItem = {
    id: 'spikeinterface-release',
    title: 'SpikeInterface · sorter and quality-metric improvements',
    summary: 'Electrophysiology and Neuropixels workflow changes for a new release.',
    url: 'https://github.com/SpikeInterface/spikeinterface/releases/tag/0.104.0',
    source: 'github.com',
    sourceLabel: 'SpikeInterface/spikeinterface',
    sourceKind: 'github',
    publishedAt: '2026-08-23T12:00:00.000Z',
    lane: 'neuro_frontier',
    tags: ['scientific software', 'release'],
    baseScore: 0.7,
    importance: 0.78,
    novelty: 0.62,
    quality: 0.84,
    momentum: 0.58,
  };
  const enriched = enrichFrontierSemantics(raw);
  assert.ok(enriched.tags.includes('neuroscience'));
  assert.ok(enriched.tags.includes('scientific software'));
  assert.equal(isFrontierSourceAdmitted(enriched), true);
  assert.ok(frontierCandidatePriority(enriched) > raw.baseScore);
});
