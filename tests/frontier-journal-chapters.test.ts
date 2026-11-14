import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { journalChapters } from '../lib/frontier/journalChapters';
import type { FrontierItem } from '../lib/frontier/types';

const source: FrontierItem = {
  id: 'source', title: 'Research source', summary: 'A test from a real source',
  url: 'https://arxiv.org/abs/2611.17323v1', source: 'arxiv.org', sourceLabel: 'arXiv',
  sourceKind: 'arxiv', publishedAt: '2026-11-13T00:00:00.000Z',
  lane: 'ml_data', tags: ['paper'],
  baseScore: .7, importance: .7, novelty: .7, quality: .7, momentum: .7,
};

test('text-only sources get honest short reading paths, not empty demo chapters', () => {
  const chapters = journalChapters(source, { hasSourceVideo: false, hasSourceFigure: false });
  assert.deepEqual(chapters.map((chapter) => chapter.id), ['frontier-story-summary', 'frontier-story-source']);
});

test('source-verified media and real figures create navigable investigation steps', () => {
  const chapters = journalChapters(source, { hasSourceVideo: true, hasSourceFigure: true });
  assert.deepEqual(chapters.map((chapter) => chapter.id),
    ['frontier-story-summary', 'frontier-story-media', 'frontier-story-figure', 'frontier-story-source']);
  assert(chapters.every((chapter) => chapter.label && chapter.shortLabel));
});

test('reported measurements and corroborating source references can add an evidence chapter', () => {
  const measured = { ...source, metrics: [
    { label: 'HF upvotes', value: '200' },
    { label: 'Measured accuracy', value: '91.2%' },
  ] };
  assert(journalChapters(measured, { hasSourceVideo: false, hasSourceFigure: false })
    .some((chapter) => chapter.id === 'frontier-evidence'));
  assert(!journalChapters({ ...source, metrics: [{ label: 'upvotes', value: '200' }] },
    { hasSourceVideo: false, hasSourceFigure: false })
    .some((chapter) => chapter.id === 'frontier-evidence'),
    'Source popularity cannot create a false research result chapter');
});

test('every guide step targets exactly one actual source-grounded article surface', () => {
  const reader = fs.readFileSync('components/frontier/FrontierFocusReader.tsx', 'utf8');
  const media = fs.readFileSync('components/frontier/FrontierJournalMedia.tsx', 'utf8');
  const evidence = fs.readFileSync('components/frontier/FrontierJournalEvidence.tsx', 'utf8');
  const guide = fs.readFileSync('components/frontier/FrontierJournalChapters.tsx', 'utf8');
  assert.match(reader, /id="frontier-story-summary"/);
  assert.match(reader, /id="frontier-story-figure"/);
  assert.match(reader, /id="frontier-story-source"/);
  assert.match(media, /id="frontier-story-media"/);
  assert.match(evidence, /id="frontier-evidence"/);
  assert.match(guide, /aria-label="Story chapters"/);
  assert.match(guide, /prefers-reduced-motion/);
  assert.doesNotMatch(guide, /Math\.random|<canvas|new WebGL/);
});
