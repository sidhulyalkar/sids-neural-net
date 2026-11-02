import assert from 'node:assert/strict';
import test from 'node:test';
import frontierSnapshot from '../content/frontier/latest.json';
import { selectFrontierColdEdition } from '../lib/frontier/coldEdition';
import { prepareFrontierCandidatePool } from '../lib/frontier/aggregate';
import { cleanFrontierEditorialText } from '../lib/frontier/editorialQuality';
import { assessFrontierEditorialAdmission } from '../lib/frontier/editorialAdmission';
import {
  buildFrontierEditorialReviewRows,
  evaluateFrontierEditorialReview,
  sampleFrontierEditorialReview,
  type FrontierEditorialReviewLabel,
} from '../lib/frontier/editorialReview';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

const now = new Date('2026-11-01T20:00:00.000Z');
function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id, title: `open-tools/${id}`,
    url: `https://github.com/open-tools/${id}`, source: 'github.com',
    sourceLabel: 'GitHub', sourceKind: 'github',
    publishedAt: now.toISOString(), lane: 'builder_signal', tags: ['open source'],
    summary: 'Open source image analysis utility with reproducible transforms and documented validation on real data, including concrete failure examples.',
    importance: 0.6, quality: 0.75, baseScore: 0.73, momentum: 0.6, novelty: 0.7,
    ...overrides,
  };
}

test('cold first edition ranks all qualified candidates before imposing its rendering budget', () => {
  const generic = Array.from({ length: 48 }, (_, index) => item('generic-' + index));
  const niche = item('spikeinterface', {
    title: 'SpikeInterface: validated cross-session electrophysiology processing',
    summary: 'The SpikeInterface release documents reproducible Neuropixels sorting, timestamps, electrode-channel metadata, and benchmark comparisons for neural recordings.',
    tags: ['spikeinterface', 'neuroscience', 'neural decoding'],
    lane: 'neuro_frontier',
  });
  const selected = selectFrontierColdEdition([...generic, niche], 14, now);
  assert.ok(selected.length > 0 && selected.length <= 14,
    'editorial composition may return fewer items when source diversity limits apply');
  assert.ok(selected.some((entry) => entry.id === niche.id),
    'high-fit neuroscience item at position 49 must survive first-paint shortlist');
});

test('source copy decodes genuine HTML entities without changing substance', () => {
  assert.equal(
    cleanFrontierEditorialText('The researchers&#8217; method &amp; control aren&#39;t equivalent.', 'rss'),
    "The researchers’ method & control aren't equivalent.",
  );
});

test('newsletter/signup pages and generic marketing are not valid editorial discoveries', () => {
  assert.equal(assessFrontierEditorialAdmission(item('newsletter', {
    sourceKind: 'rss',
    title: 'Sign up for the Football Daily newsletter: our free football email',
    summary: 'Every weekday we will deliver the latest sporting conversation directly to your inbox. Subscribe today and keep up with the hottest football news.',
  })).reason, 'promotional-title');
  assert.equal(assessFrontierEditorialAdmission(item('dsh', {
    summary: 'Towards a More Autonomous Agent System',
  })).admitted, false);
});

test('review sampler is deterministic, stratified, and includes both top-14 slates', () => {
  const items = Array.from({ length: 150 }, (_, index) => item('review-' + index, {
    sourceKind: index % 3 === 0 ? 'rss' : index % 3 === 1 ? 'github' : 'openalex',
    summary: index % 5 === 0 ? '' :
      'This specific source reports an independent analysis with methodological details, benchmark results, uncertainty estimates and reproducible examples.',
  }));
  const baseline = items.map((entry) => entry.id);
  const qualifiedOrder = [...items.slice(125), ...items.slice(0, 125)].map((entry) => entry.id);
  const rows = buildFrontierEditorialReviewRows(items, baseline, qualifiedOrder);
  const a = sampleFrontierEditorialReview(rows, 100);
  const b = sampleFrontierEditorialReview(rows, 100);
  assert.deepEqual(a.map((row) => row.id), b.map((row) => row.id));
  assert.equal(a.length, 100);
  assert.equal(new Set(a.map((row) => row.id)).size, 100);
  assert.ok(a.some((row) => row.admitted));
  assert.ok(a.some((row) => !row.admitted));
  assert.ok(new Set(a.map((row) => row.sourceKind)).size >= 3);
  for (const row of rows.filter((entry) => entry.baselineTop14 || entry.qualifiedTop14)) {
    assert.ok(a.some((entry) => entry.id === row.id), 'missing top-14 item from review sample: ' + row.id);
  }
});

test('no subjective precision metric is fabricated from missing human labels', () => {
  const items = Array.from({ length: 40 }, (_, index) => item('metric-' + index, {
    summary: index % 4 === 0 ? '' :
      'The tool implements reproducible analysis, computational visualization, testing, and clearly documented methods with measured benchmarks for users.',
  }));
  const rows = buildFrontierEditorialReviewRows(items, items.map((entry) => entry.id),
    items.slice().reverse().map((entry) => entry.id));
  const sample = sampleFrontierEditorialReview(rows, 40);
  const empty = evaluateFrontierEditorialReview(sample, []);
  assert.equal(empty.evidence, 'awaiting-human-labels');
  assert.equal(empty.reviewComplete, false);
  assert.equal(empty.metrics.worthwhileAt14.rate, null);
  assert.equal(empty.metrics.falseExclusions.rate, null);

  const partiallyLabeled: FrontierEditorialReviewLabel[] = [{
    id: sample.find((row) => row.qualifiedTop14)!.id,
    worthwhile: true, relevant: true, novel: true,
    sourceTraceable: true, claimsSupported: true,
  }];
  const partial = evaluateFrontierEditorialReview(sample, partiallyLabeled);
  assert.equal(partial.metrics.worthwhileAt14.rate, null);
  assert.equal(partial.metrics.worthwhileAt14.reviewed, 1);
  assert.equal(partial.metrics.worthwhileAt14.observedRate, 1);
  assert.equal(partial.reviewComplete, false);

  assert.throws(() => evaluateFrontierEditorialReview(sample, [...partiallyLabeled, ...partiallyLabeled]),
    /Duplicate review/);
  assert.throws(() => evaluateFrontierEditorialReview(sample, [{
    ...partiallyLabeled[0], id: 'not-in-sample',
  }]), /Unknown review/);
});

test('a complete source-checked label set measures top-14 and false exclusions', () => {
  const items = Array.from({ length: 40 }, (_, index) => item('complete-' + index, {
    summary: index % 4 === 0 ? '' :
      'The software validates concrete data transformations with measured benchmarks and describes failure modes in a reproducible technical report.',
  }));
  const rows = buildFrontierEditorialReviewRows(items,
    items.map((entry) => entry.id), items.slice().reverse().map((entry) => entry.id));
  const sample = sampleFrontierEditorialReview(rows, 40);
  const labels = sample.map((row): FrontierEditorialReviewLabel => ({
    id: row.id, worthwhile: true, relevant: true, novel: true,
    sourceTraceable: true, claimsSupported: true,
  }));
  const report = evaluateFrontierEditorialReview(sample, labels);
  assert.equal(report.reviewComplete, true);
  assert.equal(report.metrics.worthwhileAt14.rate, 1);
  assert.equal(report.metrics.relevantAt14.rate, 1);
  assert.equal(report.metrics.falseExclusions.rate, 1);
  assert.equal(report.metrics.falseExclusions.reviewed,
    sample.filter((row) => !row.admitted).length);
});


test('deep discovery can capture rejected material without publishing it into the reader pool', () => {
  const valid = item('valid-capture');
  const lowInformation = item('rejected-capture', {
    summary: '',
    baseScore: 1,
    quality: 1,
  });
  const publicPool = prepareFrontierCandidatePool([valid, lowInformation]);
  assert.equal(publicPool.editorialRejected, undefined,
    'normal live requests must not receive unpublished rejection evidence');
  assert.deepEqual(publicPool.items.map((candidate) => candidate.id), [valid.id]);

  const auditPool = prepareFrontierCandidatePool([valid, lowInformation], {
    captureEditorialReview: true,
  });
  assert.deepEqual(auditPool.items.map((candidate) => candidate.id), [valid.id]);
  assert.deepEqual(auditPool.editorialRejected?.map((candidate) => candidate.id),
    [lowInformation.id]);
});

test('real archive supplies a reproducible 100-row review candidate kit', () => {
  const raw = (frontierSnapshot as FrontierFeedResponse).items;
  const rows = buildFrontierEditorialReviewRows(raw,
    raw.map((entry) => entry.id),
    raw.slice().reverse().map((entry) => entry.id));
  const selected = sampleFrontierEditorialReview(rows, 100);
  assert.equal(selected.length, 100);
  assert.ok(selected.some((row) => row.qualifiedTop14));
  assert.ok(selected.some((row) => !row.admitted));
});
