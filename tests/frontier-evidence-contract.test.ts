import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  StoryManifestSchema,
  type EvidenceRecord,
  type StoryScene,
  type StoryManifest,
  isPublicHttpsUrl,
  parseStoryManifest,
} from '../lib/frontier/evidence/schema';
import {
  evaluateStorySceneEligibility,
  parseQualifiedStoryManifest,
} from '../lib/frontier/evidence/eligibility';

const at = '2026-11-14T19:13:13.373Z';
const hash = (letter: string) => 'sha256:' + letter.repeat(64);
const base = parseStoryManifest({
  schemaVersion: 1, itemId: 'test-source-001',
  source: {
    id: 'example:research-v1', publisher: 'Test-only source',
    url: 'https://example.org/paper', kind: 'paper',
    revision: 'r1', observedAt: at,
  },
  extractorVersion: 'test-only-1',
  compilerVersion: 'test-only-1',
  builtAt: at, state: 'basic', evidence: [], scenes: [],
});
const locator = {
  sourceId: base.source.id,
  sourceUrl: base.source.url,
  revision: base.source.revision,
};
const withEvidence = (evidence: EvidenceRecord[], source = base.source): StoryManifest => ({
  ...base, source, state: evidence.length ? 'partial' : 'basic', evidence, scenes: [],
});
const index = (manifest: StoryManifest) =>
  new Map(evaluateStorySceneEligibility(manifest).map((entry) => [entry.type, entry]));
const sampleFigure = (id: string, rightsDisplay: 'permitted' | 'link-only' | 'unknown' = 'permitted'): EvidenceRecord => ({
  id, type: 'figure', locator, status: 'publisher-reported',
  assetKey: hash('a'), caption: 'Test-only original source figure caption.',
  alt: 'Test-only source schematic showing a method.',
  rights: rightsDisplay === 'permitted' ? {
    display: 'permitted', license: 'CC0 for synthetic test fixtures', attribution: 'Synthetic test fixture',
  } : { display: rightsDisplay },
});
const measurement = (id: string, method: string, value: number, changes: Record<string, unknown> = {}): EvidenceRecord => ({
  id, type: 'measurement', locator, status: 'publisher-reported',
  metricKey: 'test-accuracy', metricLabel: 'Test accuracy', value, unit: '%',
  method, dataset: 'fixture-benchmark', split: 'heldout', protocol: 'same-evaluation',
  comparisonGroup: 'controlled-ablation', direction: 'higher',
  ...changes,
} as EvidenceRecord);

test('six frozen, real-source identity fixtures are source-only, never fabricated result data', () => {
  const corpus = JSON.parse(fs.readFileSync('tests/fixtures/frontier-evidence-source-corpus.v1.json', 'utf8')) as {
    fixtureVersion: number;
    snapshotGeneratedAt: string;
    cases: Array<{ title: string; snapshotItemId: string; manifest: unknown }>;
  };
  assert.equal(corpus.fixtureVersion, 1);
  assert.equal(corpus.cases.length, 6);
  const kinds = new Set<string>();
  for (const source of corpus.cases) {
    const parsed = parseQualifiedStoryManifest(source.manifest);
    assert.equal(parsed.itemId, source.snapshotItemId);
    assert.equal(parsed.evidence.length, 0, 'Snapshot metadata is not experimental evidence');
    assert.equal(parsed.scenes.length, 0, 'No interactive scene without extracted evidence');
    assert.equal(parsed.state, 'basic');
    assert(isPublicHttpsUrl(parsed.source.url));
    kinds.add(parsed.source.kind);
    const qualified = evaluateStorySceneEligibility(parsed);
    assert.equal(qualified.filter((scene) => scene.eligible).length, 1);
    assert.equal(qualified.find((scene) => scene.eligible)?.type, 'editorial-reading');
  }
  assert.deepEqual([...kinds].sort(), ['entertainment', 'nature', 'paper', 'repository', 'sports', 'video']);
});

test('strict manifest parsing rejects unsafe URLs, unknown keys, invalid timestamps and incompatible revisions', () => {
  for (const url of [
    'http://example.org/paper',
    'https://127.0.0.1/paper',
    'https://192.168.1.1/private',
    'https://[::1]/private',
    'https://localhost/internal',
    'https://cache.internal/data',
    'https://user:secret@example.org/paper',
    'javascript:alert(1)',
    'https://example.org:8443@localhost/x',
  ]) {
    assert.equal(isPublicHttpsUrl(url), false, 'Unsafe URL must fail: ' + url);
  }
  assert(!StoryManifestSchema.safeParse({ ...base, unknownField: 'bad' }).success);
  assert(!StoryManifestSchema.safeParse({ ...base, builtAt: 'yesterday' }).success);
  assert(!StoryManifestSchema.safeParse({ ...base, source: { ...base.source, revision: '' } }).success);
  const quote: EvidenceRecord = {
    id: 'quote-one', type: 'quotation', text: 'Source excerpt for test-only validation.',
    locator: { ...locator, revision: 'different-source-revision' }, status: 'publisher-reported',
  };
  assert(!StoryManifestSchema.safeParse(withEvidence([quote])).success);
});

test('a single source figure is eligible only when its display rights are qualified', () => {
  const linked = withEvidence([sampleFigure('figure-linked', 'link-only')]);
  assert.equal(index(linked).get('original-figure')?.eligible, false);
  const unknown = withEvidence([sampleFigure('figure-unknown', 'unknown')]);
  assert.equal(index(unknown).get('original-figure')?.eligible, false);
  const permitted = withEvidence([sampleFigure('figure-original')]);
  assert.deepEqual(index(permitted).get('original-figure')?.evidenceIds, ['figure-original']);
  assert.equal(index(permitted).get('figure-compare')?.eligible, false);
  const invalidRights = {
    ...permitted, evidence: [{ ...permitted.evidence[0], rights: { display: 'permitted' } }],
  };
  assert.equal(StoryManifestSchema.safeParse(invalidRights).success, false);
});

test('paired figure comparison requires documented pairing, same viewpoint and distinct source conditions', () => {
  const a: EvidenceRecord = {
    ...sampleFigure('image-before'), comparisonGroup: 'same-scene',
    viewpointKey: 'fixed-camera', condition: 'before', registration: 'publisher-paired',
  } as EvidenceRecord;
  const b: EvidenceRecord = {
    ...sampleFigure('image-after'), comparisonGroup: 'same-scene',
    viewpointKey: 'fixed-camera', condition: 'after', registration: 'publisher-paired',
  } as EvidenceRecord;
  assert.equal(index(withEvidence([a, b])).get('figure-compare')?.eligible, true);
  assert.equal(index(withEvidence([a, { ...b, viewpointKey: 'moved-camera' } as EvidenceRecord]))
    .get('figure-compare')?.eligible, false);
  assert.equal(index(withEvidence([a, { ...b, condition: 'before' } as EvidenceRecord]))
    .get('figure-compare')?.eligible, false);
  assert.equal(index(withEvidence([a, { ...b, registration: undefined } as EvidenceRecord]))
    .get('figure-compare')?.eligible, false);
});

test('benchmark comparison is gated by identical metric, unit, dataset, split, protocol and distinct methods', () => {
  const a = measurement('score-baseline', 'reference', 81);
  const b = measurement('score-new', 'new-method', 85);
  assert.equal(index(withEvidence([a, b])).get('benchmark-table')?.eligible, true);
  for (const [name, changed] of [
    ['unit', { unit: 'F1' }],
    ['metric', { metricKey: 'f1-score' }],
    ['dataset', { dataset: 'different-dataset' }],
    ['split', { split: 'train' }],
    ['protocol', { protocol: 'different-evaluation' }],
    ['direction', { direction: 'lower' }],
    ['cohort', { comparisonGroup: 'other' }],
    ['method', { method: 'reference' }],
  ] as const) {
    assert.equal(index(withEvidence([a, { ...b, ...changed } as EvidenceRecord]))
      .get('benchmark-table')?.eligible, false, 'Must not compare incompatible ' + name);
  }
  const activity = [measurement('score-stars', 'A', 200, { metricKey: 'stars', metricLabel: 'Stars' }),
    measurement('score-forks', 'B', 100, { metricKey: 'stars', metricLabel: 'Stars' })];
  assert.equal(index(withEvidence(activity)).get('benchmark-table')?.eligible, false);
});

test('verified engineering graph needs exact pinned commit, explicit source stages and a documented edge', () => {
  const commit = '923f305101de0644f5e752a6b59ca9bf654b9603';
  const source = { ...base.source, kind: 'repository' as const, revision: commit };
  const fileLocator = { ...locator, revision: commit };
  const f1: EvidenceRecord = {
    type: 'source-file', id: 'stage-input', status: 'publisher-reported', locator: fileLocator,
    path: 'src/input.py', commit, role: 'input',
  };
  const f2: EvidenceRecord = {
    type: 'source-file', id: 'stage-output', status: 'publisher-reported', locator: fileLocator,
    path: 'src/output.py', commit, role: 'output',
  };
  const edge: EvidenceRecord = {
    type: 'pipeline-edge', id: 'edge-flow', status: 'publisher-reported', locator: fileLocator,
    fromId: 'stage-input', toId: 'stage-output', relation: 'flows-into',
  };
  assert.equal(index(withEvidence([f1, f2, edge], source)).get('verified-pipeline')?.eligible, true);
  assert.equal(index(withEvidence([f1, f2], source)).get('verified-pipeline')?.eligible, false);
  assert.equal(index(withEvidence([{ ...f1, commit: 'a'.repeat(40) } as EvidenceRecord, f2, edge], source))
    .get('verified-pipeline')?.eligible, false);
  assert.equal(index(withEvidence([f1, f2, { ...edge, toId: 'not-documented' } as EvidenceRecord], source))
    .get('verified-pipeline')?.eligible, false);
  assert.equal(index(withEvidence([f1, f2, edge])).get('verified-pipeline')?.eligible, false);
});

test('temporal and physiological views require real time bases; sports and geography require typed observations', () => {
  const e1: EvidenceRecord = { type: 'event', id: 'first-event', locator, status: 'publisher-reported',
    eventGroup: 'source-clip', label: 'First observed event', eventType: 'boundary', offsetSeconds: 2 };
  const e2: EvidenceRecord = { ...e1, id: 'second-event', offsetSeconds: 8 };
  assert.equal(index(withEvidence([e1, e2])).get('event-timeline')?.eligible, true);
  assert.equal(index(withEvidence([e1, { ...e2, eventGroup: 'other' }]))
    .get('event-timeline')?.eligible, false);
  const series: EvidenceRecord = {
    type: 'series', id: 'signal-one', locator, status: 'publisher-reported',
    assetKey: hash('b'), xUnit: 's', yUnit: 'uV', clockId: 'experiment-clock',
    channel: 'LFP', sampleCount: 1200, sampleRateHz: 1000, startAt: at,
  };
  const second: EvidenceRecord = { ...series, id: 'signal-two', channel: 'Pupil' };
  assert.equal(index(withEvidence([series, second])).get('time-aligned-signals')?.eligible, true);
  assert.equal(index(withEvidence([series, { ...second, startAt: '2026-11-14T19:13:14.373Z' }]))
    .get('time-aligned-signals')?.eligible, false);
  const matchSource = { ...base.source, kind: 'sports' as const };
  const match: EvidenceRecord = {
    type: 'sports-state', id: 'official-score', status: 'publisher-reported', locator,
    eventId: 'nba-example', league: 'Example competition', statusLabel: 'Upcoming',
    observedAt: at, competitors: [{ name: 'Team A' }, { name: 'Team B' }],
  };
  assert.equal(index(withEvidence([match], matchSource)).get('sports-state')?.eligible, true);
  assert.equal(index(withEvidence([match])).get('sports-state')?.eligible, false);
  const natureSource = { ...base.source, kind: 'nature' as const };
  const point: EvidenceRecord = {
    type: 'geo-observation', id: 'observed-point', status: 'publisher-reported', locator,
    observationId: 'test-point', latitude: 0, longitude: 0, crs: 'EPSG:4326', observedAt: at,
  };
  assert.equal(index(withEvidence([point], natureSource)).get('geospatial-observations')?.eligible, true);
  assert(!StoryManifestSchema.safeParse(withEvidence([{ ...point, latitude: 120 } as EvidenceRecord], natureSource)).success);
});

test('video is link-only unless explicit rights permit display; no autoplay capabilities are advertised', () => {
  const video: EvidenceRecord = {
    type: 'video', id: 'original-video', status: 'publisher-reported', locator,
    sourceUrl: 'https://www.youtube.com/watch?v=AH315a5F8-g',
    durationSeconds: 83, rights: { display: 'link-only' },
  };
  assert.equal(index(withEvidence([video])).get('source-video')?.eligible, true);
  assert.deepEqual(index(withEvidence([video])).get('source-video')?.operations, ['inspect']);
  assert.equal(index(withEvidence([{ ...video, rights: { display: 'unknown' } }]))
    .get('source-video')?.eligible, false);
});

test('a manifest cannot declare fabricated operations, missing evidence, false derivation or unreviewed data', () => {
  const paper = withEvidence([sampleFigure('source-figure')]);
  const scene: StoryScene = {
    id: 'inspect-figure', type: 'original-figure', title: 'Source figure',
    question: 'What does the published original figure show?',
    evidenceIds: ['source-figure'], operations: ['inspect'],
    accessibleSummary: 'Inspect the real source figure and caption.',
    annotation: 'publisher-original',
  };
  assert.deepEqual(parseQualifiedStoryManifest({ ...paper, scenes: [scene] }).scenes, [scene]);
  assert.throws(() => parseQualifiedStoryManifest({ ...paper, scenes: [{
    ...scene, operations: ['scrub'],
  }] }), /unsupported operation/);
  assert.throws(() => parseQualifiedStoryManifest({ ...paper, scenes: [{
    ...scene, annotation: 'verified-derived',
  }] }), /independently verified/);
  assert(!StoryManifestSchema.safeParse({ ...paper, scenes: [{
    ...scene, evidenceIds: ['made-up-id'],
  }] }).success);
  assert(!StoryManifestSchema.safeParse({ ...paper, evidence: [
    sampleFigure('source-figure'), sampleFigure('source-figure'),
  ] }).success);
  const unreviewed = { ...sampleFigure('source-figure'), status: 'extracted-needs-review' };
  assert(!StoryManifestSchema.safeParse({ ...paper, evidence: [unreviewed], scenes: [scene] }).success);
});

test('scene eligibility is deterministic, bounded, and emits reasons for every unsupported scene', () => {
  const first = evaluateStorySceneEligibility(base);
  assert.deepEqual(first, evaluateStorySceneEligibility(base));
  assert.equal(first.length, 10);
  assert(first.every((scene) => scene.eligible || scene.reason.length > 14));
  assert.deepEqual(first.filter((scene) => scene.eligible).map((scene) => scene.type),
    ['editorial-reading']);
});
