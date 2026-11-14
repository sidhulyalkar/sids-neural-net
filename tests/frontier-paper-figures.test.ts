import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { enrichFrontierPaperFigures, extractArxivHtmlFigures, fetchArxivHtmlFigures } from '../lib/frontier/paperFigures';
import type { FrontierItem } from '../lib/frontier/types';

const paper: FrontierItem = {
  id: 'arxiv-one', title: 'A source paper', summary: 'A real scientific paper.',
  url: 'https://arxiv.org/abs/2611.17323v1', source: 'arxiv.org', sourceLabel: 'arXiv',
  sourceKind: 'arxiv', publishedAt: '2026-11-13T00:00:00.000Z', lane: 'ml_data',
  tags: ['paper'], baseScore: .7, importance: .7, novelty: .7, quality: .7, momentum: .7,
};
const fig = (src: string, id = 'S1.F1') =>
  `<figure class="ltx_figure" id="${id}"><img src="${src}" alt="Original diagram">
  <figcaption class="ltx_caption">Figure 1: The actual observed architecture and evaluation setup.</figcaption></figure>`;

test('only caption-linked raster figures in verified arXiv HTML are promoted', () => {
  const html = '<html><body>'
    + '<img src="not-a-figure.png">'
    + fig('x1.png')
    + fig('x1.png', 'S2.F2')
    + `<figure class="ltx_table" id="T1"><figcaption>Table, not an image</figcaption></figure>`
    + fig('https://evil.example/steal.png', 'S3.F3')
    + fig('data:image/png;base64,FAKE', 'S4.F4')
    + fig('x2.jpg', 'S5.F5')
    + '</body></html>';
  const result = extractArxivHtmlFigures(html, '2611.17323v1');
  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'https://arxiv.org/html/2611.17323v1/x1.png');
  assert.equal(result[0].sourceUrl, 'https://arxiv.org/html/2611.17323v1#S1.F1');
  assert.equal(result[0].caption, 'Figure 1: The actual observed architecture and evaluation setup.');
  assert.equal(result[0].credit, 'arXiv · original paper figure');
  assert.equal(result[1].url, 'https://arxiv.org/html/2611.17323v1/x2.jpg');
  assert.deepEqual(extractArxivHtmlFigures(html, 'not-an-arxiv-id'), []);
});

test('missing captions and unsafe locations cannot become scientific evidence', () => {
  const samples = [
    '<figure class="ltx_figure"><img src="x1.png"></figure>',
    '<figure class="ltx_figure"><img src="x1.png"><figcaption>Too short</figcaption></figure>',
    '<figure class="ltx_figure"><img src="/private/x1.png"><figcaption>Caption exists but source path is not HTML paper.</figcaption></figure>',
    '<figure class="ltx_figure"><img src="//evil.example/x.png"><figcaption>Caption exists but host is not arXiv.</figcaption></figure>',
    '<figure class="ltx_figure"><img src="x1.svg"><figcaption>SVG is not qualified by the raster-only stage.</figcaption></figure>',
  ];
  for (const html of samples) {
    assert.deepEqual(extractArxivHtmlFigures(html, '2611.17323v1'), []);
  }
  const escaped = '<figure class="ltx_figure"><img src="img&amp;one.png"><figcaption>'
    + 'Figure 2: Birds &amp; their habitats&#46; Detailed results.</figcaption></figure>';
  const entityFigure = extractArxivHtmlFigures(escaped, '2611.17323v1');
  assert.equal(entityFigure.length, 1, 'Caption-backed original source assets remain valid');
  assert.equal(entityFigure[0].url, 'https://arxiv.org/html/2611.17323v1/img&one.png');
  assert.equal(entityFigure[0].caption, 'Figure 2: Birds & their habitats. Detailed results.');
});

test('source fetch fails closed for 404, wrong content type, wrong host and unsupported IDs', async () => {
  let called = 0;
  const notFound: typeof fetch = async () => { called++; return new Response('Missing', { status: 404 }); };
  assert.deepEqual(await fetchArxivHtmlFigures(paper, notFound, 100), []);
  assert.equal(called, 1);
  assert.deepEqual(await fetchArxivHtmlFigures({ ...paper, url: 'https://other.example/abs/2611.17323v1' }, notFound, 100), []);
  assert.equal(called, 1, 'Never contact the network for unrelated sources');
  const plain: typeof fetch = async () => new Response(fig('x1.png'), { status: 200, headers: { 'content-type': 'text/plain' } });
  assert.deepEqual(await fetchArxivHtmlFigures(paper, plain, 100), []);
  const htmlResponse: typeof fetch = async () => new Response(fig('x1.png'), { status: 200, headers: { 'content-type': 'text/html' } });
  const figures = await fetchArxivHtmlFigures(paper, htmlResponse, 100);
  assert.equal(figures.length, 1);
  assert.equal(figures[0].url, 'https://arxiv.org/html/2611.17323v1/x1.png');
});

test('scheduled enrichment only changes selected papers and leaves others intact', async () => {
  const second = { ...paper, id: 'arxiv-two', url: 'https://arxiv.org/abs/2611.17316v1' };
  const third = { ...paper, id: 'arxiv-three', url: 'https://arxiv.org/abs/2611.17329v1' };
  const external = { ...paper, id: 'external', sourceKind: 'github' as const, url: 'https://github.com/allenai/olmo' };
  const feed = { items: [paper, external, second, third], generatedAt: '2026-11-13T00:00:00.000Z', sources: [] };
  const requested: string[] = [];
  const mock: typeof fetch = async (input) => {
    requested.push(String(input));
    return new Response(fig('x1.png'), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const result = await enrichFrontierPaperFigures(feed, { maxPapers: 2, minIntervalMs: 0, fetchImpl: mock, timeoutMs: 100 });
  assert.equal(result.report.attempted, 2);
  assert.equal(result.report.papersWithFigures, 2);
  assert.equal(result.report.figuresAdded, 2);
  assert.deepEqual(requested, ['https://arxiv.org/html/2611.17323v1', 'https://arxiv.org/html/2611.17316v1']);
  assert.equal(result.feed.items[0].figures?.length, 1);
  assert.equal(result.feed.items[1], external, 'Unrelated GitHub item is untouched');
  assert.equal(result.feed.items[3].figures, undefined, 'Budget leaves later papers unchanged');
  assert.equal(feed.items[0].figures, undefined, 'Original immutable snapshot is not mutated');
});

test('the live reader stays decoupled from paper enrichment and the daily workflow gates the external fetch', () => {
  const reader = fs.readFileSync('components/frontier/FrontierFocusReader.tsx', 'utf8');
  const snapshot = fs.readFileSync('scripts/build-frontier-snapshot.ts', 'utf8');
  const workflow = fs.readFileSync('.github/workflows/frontier-refresh.yml', 'utf8');
  assert.doesNotMatch(reader, /fetchArxivHtmlFigures|enrichFrontierPaperFigures/);
  assert.match(snapshot, /process\.env\.FRONTIER_ENRICH_SOURCE_FIGURES === '1'/);
  assert.match(workflow, /FRONTIER_ENRICH_SOURCE_FIGURES/);
});
