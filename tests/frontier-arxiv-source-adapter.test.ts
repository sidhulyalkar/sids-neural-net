import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { evaluateStorySceneEligibility, parseQualifiedStoryManifest } from '../lib/frontier/evidence/eligibility';
import {
  ArxivHtmlCandidateSchema, compileArxivEvidence, sha256Caption,
  type ArxivHtmlCandidates, type ApprovedFigure,
} from '../lib/frontier/evidence/arxivAdapter';

const PAPER_ID = '2611.17323v1';
const SOURCE = 'https://arxiv.org/html/' + PAPER_ID;
const AT = '2026-11-14T19:13:13.373Z';
const FIXTURE = 'tests/fixtures/frontier/arxiv-synthetic-structure.html';

/** Controlled offline Python standard-library parser, not live publisher I/O. */
function extract(paperId = PAPER_ID, input?: string): { status: number | null; output?: unknown; stderr: string } {
  const result = spawnSync('python3', [
    'scripts/frontier/extract_arxiv_html.py', '--paper-id', paperId,
    ...(input === undefined ? ['--input', FIXTURE] : []),
  ], {
    input,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: result.stdout.trim() ? JSON.parse(result.stdout) : undefined,
    stderr: result.stderr,
  };
}
function candidates(): ArxivHtmlCandidates {
  const result = extract();
  assert.equal(result.status, 0, result.stderr);
  return ArxivHtmlCandidateSchema.parse(result.output);
}
const samplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLhXQAAAABJRU5ErkJggg==',
  'base64',
);
function approvalFor(figure: ArxivHtmlCandidates['figures'][number], overrides: Partial<ApprovedFigure> = {}): ApprovedFigure {
  return {
    sourceUrl: figure.sourceUrl,
    imageUrl: figure.imageUrl,
    captionSha256: sha256Caption(figure.caption),
    bytes: samplePng,
    rights: {
      display: 'permitted',
      license: 'Synthetic test fixture only',
      attribution: 'Source-shaped test data, not a publisher figure',
    },
    ...overrides,
  };
}

test('offline HTML parser finds actual structural figure/caption pairs, not arbitrary images or script content', () => {
  const parsed = candidates();
  assert.equal(parsed.rightsStatus, 'unverified');
  assert.equal(parsed.paperId, PAPER_ID);
  assert.equal(parsed.htmlUrl, SOURCE);
  assert.deepEqual(parsed.sections.map((section) => [section.id, section.title]), [
    ['S1', '1 Introduction'], ['S2', '2 Experimental design'],
  ]);
  assert.equal(parsed.diagnostics.figureElementsSeen, 6);
  assert.equal(parsed.diagnostics.candidatesWithImageAndCaption, 2);
  assert(parsed.diagnostics.rejectedImageReferences >= 3);
  assert.deepEqual(parsed.figures.map((figure) => [figure.id, figure.imageUrl, figure.sectionId]), [
    ['S1.F1', SOURCE + '/x1.png', 'S1'],
    ['S2.F1', SOURCE + '/figures/experiment.jpeg', 'S2'],
  ]);
  assert(parsed.figures[1].caption.includes('nested emphasis and entities & text'));
  assert.equal(parsed.figures[0].sourceUrl, SOURCE + '#S1.F1');
  assert(!JSON.stringify(parsed).includes('script.png'));
});

test('the parser fails closed on unsafe paper IDs, excess bytes and invalid encodings', () => {
  const badIds = ['anything', '../private', '2611.17323v0', '2611.17323v1/other', 'http://example.com'];
  for (const id of badIds) {
    const result = extract(id, '<section id="S1"><h2>Test</h2></section>');
    assert.equal(result.status, 2, 'Rejected unsafe ID ' + id);
  }
  const oversized = extract(PAPER_ID, '<html>' + 'a'.repeat(1_400_002) + '</html>');
  assert.equal(oversized.status, 2);
  assert.match(oversized.stderr, /exceeds bounded extraction limit/);
});

test('malformed image ports and doubly encoded traversal cannot poison an otherwise parseable paper', () => {
  const malicious = '<section id="S1"><h2>1 Example</h2>'
    + '<figure class="ltx_figure" id="S1.F1"><img src="https://arxiv.org:garbage/html/2611.17323v1/a.png">'
    + '<figcaption>This test figure is not allowed to smuggle malformed network destinations.</figcaption></figure>'
    + '<figure class="ltx_figure" id="S1.F2"><img src="%252e%252e/escape.png">'
    + '<figcaption>Double-encoded parent paths cannot become original publisher assets.</figcaption></figure>'
    + '</section>';
  const result = extract(PAPER_ID, malicious);
  assert.equal(result.status, 0, result.stderr);
  const candidate = ArxivHtmlCandidateSchema.parse(result.output);
  assert.equal(candidate.figures.length, 0);
  assert.equal(candidate.sections.length, 1);
  assert.equal(candidate.diagnostics.rejectedImageReferences, 2);
});

test('source HTML is candidate data, not permission to render source figures', () => {
  const parsed = candidates();
  const { manifest, assets } = compileArxivEvidence({
    candidates: parsed, itemId: 'ingest-arxiv-l2kgb2', observedAt: AT, builtAt: AT,
  });
  assert.equal(manifest.source.id, 'arxiv:' + PAPER_ID);
  assert.equal(manifest.source.url, 'https://arxiv.org/abs/' + PAPER_ID);
  assert.equal(manifest.source.revision, 'v1');
  assert.equal(manifest.state, 'basic');
  assert.equal(manifest.scenes.length, 0);
  assert.equal(assets.length, 0);
  assert.equal(manifest.evidence.length, 2, 'Only exact source section headings are quotable');
  assert(manifest.evidence.every((evidence) => evidence.type === 'quotation'));
  assert.equal(evaluateStorySceneEligibility(manifest)
    .find((scene) => scene.type === 'original-figure')?.eligible, false);
});

test('an explicitly approved original image becomes verifiable, hashed and eligible as one source figure', () => {
  const parsed = candidates();
  const first = parsed.figures[0];
  const { manifest, assets } = compileArxivEvidence({
    candidates: parsed, itemId: 'ingest-arxiv-l2kgb2', observedAt: AT, builtAt: AT,
    approvals: [approvalFor(first)],
  });
  assert.equal(manifest.state, 'partial');
  assert.equal(manifest.scenes.length, 1);
  assert.deepEqual(manifest.scenes[0].operations, ['inspect']);
  const record = manifest.evidence.find((item) => item.type === 'figure');
  assert(record && record.type === 'figure');
  assert.equal(record.assetKey, 'sha256:' + createHash('sha256').update(samplePng).digest('hex'));
  assert.equal(record.locator.sourceUrl, SOURCE + '#S1.F1');
  assert.equal(record.rights.display, 'permitted');
  assert.equal(assets.length, 1);
  assert.equal(assets[0].mimeType, 'image/png');
  assert.equal(assets[0].key, record.assetKey);
  assert.equal(parseQualifiedStoryManifest(manifest).scenes[0].type, 'original-figure');
});

test('stale, unlicensed, off-source, mismatched, duplicate or invalid assets never become an evidence scene', () => {
  const parsed = candidates();
  const first = parsed.figures[0];
  const valid = approvalFor(first);
  const invalid: Array<[string, Partial<ApprovedFigure>]> = [
    ['mismatched image', { imageUrl: 'https://arxiv.org/html/' + PAPER_ID + '/x99.png' }],
    ['stale caption', { captionSha256: '0'.repeat(64) }],
    ['unknown copyright', { rights: { display: 'unknown' } }],
    ['unlicensed display', { rights: { display: 'permitted' } }],
    ['wrong bytes', { bytes: Buffer.from('This is an HTML response rather than an image.') }],
    ['oversized asset', { bytes: Buffer.alloc(4 * 1024 * 1024 + 1, 0) }],
  ];
  for (const [reason, override] of invalid) {
    assert.throws(() => compileArxivEvidence({
      candidates: parsed, itemId: 'test-item', observedAt: AT, builtAt: AT,
      approvals: [approvalFor(first, override)],
    }), /./, reason);
  }
  assert.throws(() => compileArxivEvidence({
    candidates: parsed, itemId: 'test-item', observedAt: AT, builtAt: AT,
    approvals: [valid, valid],
  }), /Duplicate figure approval/);
  assert.equal(ArxivHtmlCandidateSchema.safeParse({
    ...parsed, figures: [{ ...first, imageUrl: 'https://evil.example/steal.png' }],
    diagnostics: { ...parsed.diagnostics, candidatesWithImageAndCaption: 1 },
  }).success, false);
  assert.equal(ArxivHtmlCandidateSchema.safeParse({
    ...parsed, figures: [{ ...first, sourceUrl: SOURCE + '#made-up' }],
    diagnostics: { ...parsed.diagnostics, candidatesWithImageAndCaption: 1 },
  }).success, false);
  assert.equal(ArxivHtmlCandidateSchema.safeParse({
    ...parsed, paperId: '2611.99999v1',
  }).success, false, 'A candidate cannot mislabel a different source paper');
});

test('a second independent approved figure enables source figure switching, not an invented numerical chart', () => {
  const parsed = candidates();
  const second = parsed.figures[1];
  const jpegBytes = Buffer.from([
    255, 216, 255, 224, 0, 16, ...Buffer.alloc(24).values(), 255, 217,
  ]);
  const approved = approvalFor(second, { bytes: jpegBytes });
  const { manifest } = compileArxivEvidence({
    candidates: parsed, itemId: 'ingest-arxiv-l2kgb2', observedAt: AT, builtAt: AT,
    approvals: [approvalFor(parsed.figures[0]), approved],
  });
  assert.equal(manifest.scenes[0].evidenceIds.length, 2);
  assert.deepEqual(manifest.scenes[0].operations, ['inspect', 'switch']);
  const matrix = evaluateStorySceneEligibility(manifest);
  assert.equal(matrix.find((scene) => scene.type === 'benchmark-table')?.eligible, false);
  assert.equal(matrix.find((scene) => scene.type === 'figure-compare')?.eligible, false,
    'Two paper figures without a source-verified pairing cannot become a before/after slider');
});

test('input script and parser are network-free and cannot be loaded by the cold reader', () => {
  const python = readFileSync('scripts/frontier/extract_arxiv_html.py', 'utf8');
  const adapter = readFileSync('lib/frontier/evidence/arxivAdapter.ts', 'utf8');
  const cold = readFileSync('app/frontier/page.tsx', 'utf8');
  const snapshot = readFileSync('lib/frontier/snapshotFeed.ts', 'utf8');
  assert(!/urllib\.request|requests\.get|httpx\.get|urlopen/.test(python));
  assert(!/fetch\(|XMLHttpRequest|https\.request/.test(adapter));
  assert(!cold.includes('arxivAdapter'));
  assert(!snapshot.includes('arxivAdapter'));
});
