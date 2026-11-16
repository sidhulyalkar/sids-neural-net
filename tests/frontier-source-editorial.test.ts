import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSourceEditorial } from '../lib/frontier/evidence/editorial';
import { parseQualifiedStoryManifest } from '../lib/frontier/evidence/eligibility';

const root = 'content/frontier/stories/ingest-arxiv-l2kgb2';
const manifest = parseQualifiedStoryManifest(JSON.parse(fs.readFileSync(root + '/manifest.json', 'utf8')));
const raw: unknown = JSON.parse(fs.readFileSync(root + '/editorial.json', 'utf8'));

test('the published AgentSSL signals match the source and exact revision', () => {
  const editorial = parseSourceEditorial(raw, manifest);
  assert.equal(editorial.title, 'AgentSSL: Can MLE Agents Leverage Unlabeled Data?');
  assert.equal(editorial.source.revision, 'v1');
  assert.equal(editorial.itemId, manifest.itemId);
  assert.deepEqual(editorial.signals.map((signal) => signal.value), ['8 / 12', '+21.8%', '47%', '16,977']);
  assert(editorial.signals.every((signal) =>
    signal.sourceUrl.startsWith('https://arxiv.org/html/2611.17323v1#')));
});

test('research signals fail closed on cross-source citations, invalid revisions and duplicate IDs', () => {
  const editorial = parseSourceEditorial(raw, manifest);
  const modify = (fn: (value: typeof editorial) => void) => {
    const copy = structuredClone(editorial);
    fn(copy);
    return copy;
  };
  assert.throws(() => parseSourceEditorial(modify((x) => { x.source.revision = 'v2'; }), manifest));
  assert.throws(() => parseSourceEditorial(modify((x) => { x.source.url = 'https://arxiv.org/abs/2611.00001v1'; }), manifest));
  assert.throws(() => parseSourceEditorial(modify((x) => { x.signals[0].sourceUrl = 'https://arxiv.org/html/2611.17323v1#Invented'; }), manifest));
  assert.throws(() => parseSourceEditorial(modify((x) => { x.signals[0].id = x.signals[1].id; }), manifest));
  assert.throws(() => parseSourceEditorial(modify((x) => { x.insight.sourceUrl = 'http://127.0.0.1/private'; }), manifest));
  assert.throws(() => parseSourceEditorial(modify((x) => { x.itemId = 'another-paper'; }), manifest));
});

test('source headings are the only valid claim anchors; the UI cannot invent figures', () => {
  const editorial = parseSourceEditorial(raw, manifest);
  const removed = { ...manifest, evidence: manifest.evidence.filter((entry) =>
    entry.type !== 'quotation' || entry.locator.section !== 'S5') };
  assert.throws(() => parseSourceEditorial(editorial, removed));
  const reader = fs.readFileSync('components/frontier/evidence/FrontierEvidenceStory.tsx', 'utf8');
  assert.match(reader, /Publisher-reported research highlights/);
  assert.match(reader, /editorial\.signals\.map/);
  assert.doesNotMatch(reader, /<canvas|Math\.random/);
  const route = fs.readFileSync('app/frontier/story/[id]/page.tsx', 'utf8');
  assert.match(route, /story\.editorial\.title/);
});


test('editorial explanation has two distinct qualified phases and six publisher-anchored stages', () => {
  const editorial = parseSourceEditorial(raw, manifest);
  assert.deepEqual(editorial.mechanisms.map((mechanism) => mechanism.id), ['discovery', 'selection']);
  assert(editorial.mechanisms.every((mechanism) => mechanism.stages.length === 3));
  for (const mechanism of editorial.mechanisms) {
    assert(mechanism.stages.every((stage) =>
      stage.sourceUrl.startsWith('https://arxiv.org/html/2611.17323v1#')));
    assert(mechanism.sourceUrl.startsWith('https://arxiv.org/html/2611.17323v1#'));
  }
});

test('conceptual flow rejects unapproved source sections or repeated/removed phases', () => {
  const editorial = parseSourceEditorial(raw, manifest);
  const mutate = (fn: (editorial: typeof editorial) => void) => {
    const candidate = structuredClone(editorial);
    fn(candidate);
    return candidate;
  };
  assert.throws(() => parseSourceEditorial(mutate((x) => {
    x.mechanisms[0].stages[0].sourceUrl = 'https://arxiv.org/html/2611.17323v1#NotASection';
  }), manifest));
  assert.throws(() => parseSourceEditorial(mutate((x) => {
    x.mechanisms[0].id = 'selection';
  }), manifest));
  assert.throws(() => parseSourceEditorial(mutate((x) => {
    x.mechanisms.pop();
  }), manifest));
  assert.throws(() => parseSourceEditorial(mutate((x) => {
    x.mechanisms[1].sourceUrl = 'https://example.com/other-paper';
  }), manifest));
  const reader = fs.readFileSync('components/frontier/evidence/FrontierEvidenceStory.tsx', 'utf8');
  assert.match(reader, /data-frontier-explanation="editorial"/);
  assert.match(reader, /setMechanismFocus/);
  assert.match(reader, /An editorial schematic based on the authors/);
});
