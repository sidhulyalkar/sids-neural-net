import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { sourceChapterMap } from '../lib/frontier/evidence/sourceChapterMap';
import { parseQualifiedStoryManifest } from '../lib/frontier/evidence/eligibility';
import type { EvidenceRecord } from '../lib/frontier/evidence/schema';

const at = '2026-11-14T19:13:13.373Z';
const source = {
  id: 'example:guided-source-v1', kind: 'paper' as const, revision: 'v1',
  publisher: 'Synthetic source', url: 'https://example.org/paper', observedAt: at,
};
const quote = (id: string, section: string, title: string, status: 'publisher-reported' | 'extracted-needs-review' = 'publisher-reported') => ({
  id, type: 'quotation' as const, role: 'section-heading' as const, status, text: title,
  locator: {
    sourceId: source.id, sourceUrl: source.url + '#' + section,
    revision: source.revision, section,
  },
});
const figure: EvidenceRecord = {
  id: 'source-figure', type: 'figure', status: 'publisher-reported',
  assetKey: 'sha256:' + 'a'.repeat(64),
  caption: 'Synthetic original source figure used for integration testing.',
  alt: 'A synthetic method schematic for testing chapter figures.',
  locator: { sourceId: source.id, sourceUrl: source.url + '#figure', revision: 'v1', section: 'S2' },
  rights: { display: 'permitted', license: 'Synthetic test fixture', attribution: 'Synthetic source' },
};
const manifest = (evidence: EvidenceRecord[]) => parseQualifiedStoryManifest({
  schemaVersion: 1, itemId: 'test-source-chapters', source,
  extractorVersion: 'test', compilerVersion: 'test', builtAt: at,
  state: evidence.length ? 'partial' : 'basic', evidence, scenes: [],
});

test('source headers create real chapter navigation with publisher anchors and figure associations', () => {
  const result = sourceChapterMap(manifest([
    quote('intro', 'S1', '1 Introduction'),
    quote('method', 'S2', '2 Experiment Design'),
    quote('result', 'S3', '3 Results and Analysis'),
    quote('limits', 'S4', '4 Discussion and limitations'),
    figure,
  ]));
  assert.deepEqual(result.map((chapter) => chapter.id), ['context', 'methods', 'results', 'limitations']);
  assert.deepEqual(result.map((chapter) => chapter.sections[0].sectionId), ['S1', 'S2', 'S3', 'S4']);
  assert.deepEqual(result[1].sections[0].figureIds, ['source-figure']);
  assert.equal(result[0].sections[0].sourceUrl, 'https://example.org/paper#S1');
  assert.equal(result[1].sections[0].title, '2 Experiment Design');
});

test('do not infer unsupported methods or result claims from generic text', () => {
  const result = sourceChapterMap(manifest([
    quote('unrelated', 'S1', 'A New Frontier'),
    quote('another', 'S2', 'B What happened in this story?'),
  ]));
  assert.deepEqual(result.map((chapter) => chapter.id), ['other']);
  assert.deepEqual(result[0].sections.map((section) => section.title),
    ['A New Frontier', 'B What happened in this story?']);
});

test('only verified source headings are navigable and no empty chapters are made up', () => {
  const noEvidence = sourceChapterMap(manifest([]));
  assert.deepEqual(noEvidence, []);
  const reviewed = sourceChapterMap(manifest([
    quote('intro', 'S1', '1 Introduction'),
    quote('unreviewed', 'S2', '2 Results', 'extracted-needs-review'),
  ]));
  assert.deepEqual(reviewed.map((chapter) => chapter.id), ['context']);
});

test('publisher headings remain bounded and duplicate section IDs cannot create phantom chapters', () => {
  const multiple = Array.from({ length: 15 }, (_, i) =>
    quote('extra-' + i, 'SX' + i, 'Appendix Topic ' + i));
  const result = sourceChapterMap(manifest([...multiple,
    quote('duplicate-section', 'SX0', 'Appendix Topic duplicate')]));
  assert.equal(result.length, 1);
  assert.equal(result[0].sections.length, 5);
  assert(result[0].sections.every((section) => section.sourceUrl.startsWith('https://example.org/paper#')));
});

test('source chapters require the source route and no additional publisher fetch', () => {
  const view = readFileSync('components/frontier/evidence/FrontierEvidenceStory.tsx', 'utf8');
  assert.match(view, /sourceChapterMap\(manifest\)/);
  assert.match(view, /aria-label="Research chapters"/);
  assert.match(view, /data-selected-source-chapter=\{chapter\.id\}/);
  assert.match(view, /section\.sourceUrl/);
  assert.doesNotMatch(view, /fetch\(section\.sourceUrl/);
});
