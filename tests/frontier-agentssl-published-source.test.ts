import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseQualifiedStoryManifest } from '../lib/frontier/evidence/eligibility';
import { sourceChapterMap } from '../lib/frontier/evidence/sourceChapterMap';

const root = 'content/frontier/stories/ingest-arxiv-l2kgb2/';
const raw = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')) as unknown;
const assets = JSON.parse(readFileSync(root + 'assets.json', 'utf8')) as unknown;
const provenance = JSON.parse(readFileSync(root + 'provenance.json', 'utf8')) as {
  sourceHtmlSha256: string;
  observedFigureElements: number;
  eligibleFigureCandidates: number;
  selectedNavigationSections: number;
  approvedDisplayAssets: number;
  figureRightsStatus: string;
  paperLicenseObservedInHtml: boolean;
  deploymentApproved: boolean;
};

test('actual arXiv source-only manuscript passes the qualified story contract', () => {
  const manifest = parseQualifiedStoryManifest(raw);
  assert.equal(manifest.itemId, 'ingest-arxiv-l2kgb2');
  assert.equal(manifest.source.id, 'arxiv:2611.17323v1');
  assert.equal(manifest.source.revision, 'v1');
  assert.equal(manifest.source.url, 'https://arxiv.org/abs/2611.17323v1');
  assert.equal(manifest.evidence.length, 23);
  assert.equal(manifest.state, 'basic');
  assert.equal(manifest.scenes.length, 0);
  assert.deepEqual(assets, [], 'There must be no unreviewed publisher images');
  for (const record of manifest.evidence) {
    assert.equal(record.type, 'quotation');
    assert.equal(record.status, 'publisher-reported');
    if (record.type !== 'quotation') throw new Error('Unexpected non-text evidence');
    assert.equal(record.role, 'section-heading');
    assert.equal(record.locator.sourceId, manifest.source.id);
    assert.equal(record.locator.revision, 'v1');
    assert.match(record.locator.sourceUrl, /^https:\/\/arxiv\.org\/html\/2611\.17323v1#[A-Za-z0-9:.]+$/);
  }
});

test('actual original sections support a guided map without fabricated figures or findings', () => {
  const chapters = sourceChapterMap(parseQualifiedStoryManifest(raw));
  assert.deepEqual(chapters.map((chapter) => chapter.id),
    ['context', 'methods', 'results', 'limitations', 'other']);
  assert(chapters.some((c) => c.sections.some((section) =>
    section.sectionId === 'S3' && section.title === '3 Problem Setup')));
  assert(chapters.some((c) => c.sections.some((section) =>
    section.sectionId === 'S9.SS0.SSS0.Px1' && section.title === 'Limitations and future work.')));
  assert(chapters.every((chapter) =>
    chapter.sections.every((section) => section.figureIds.length === 0)));
});

test('source digest and publisher-reported figure eligibility remain separate from reuse rights', () => {
  assert.match(provenance.sourceHtmlSha256, /^[0-9a-f]{64}$/);
  assert.equal(provenance.sourceHtmlSha256,
    'e46bc4a222a5638431984772412f7dd96b60acd99977376e0b2890e27a6bffee');
  assert.equal(provenance.observedFigureElements, 16);
  assert.equal(provenance.eligibleFigureCandidates, 4);
  assert.equal(provenance.selectedNavigationSections, 23);
  assert.equal(provenance.approvedDisplayAssets, 0);
  assert.equal(provenance.figureRightsStatus, 'pending-individual-review');
  assert.equal(provenance.paperLicenseObservedInHtml, false);
  assert.equal(provenance.deploymentApproved, false);
});

test('a source-only publication cannot be upgraded into an image scene by editing its declaration', () => {
  const forged = { ...(raw as Record<string, unknown>), state: 'partial', scenes: [{
    id: 'figure-stolen', type: 'original-figure',
    title: 'Unlicensed image', question: 'Is this source image actually permitted?',
    evidenceIds: ['figure-not-extracted'], operations: ['inspect'],
    accessibleSummary: 'An image without provenance must not render.',
    annotation: 'publisher-original',
  }] };
  assert.throws(() => parseQualifiedStoryManifest(forged));
});
