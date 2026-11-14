import assert from 'node:assert/strict';
import {
  mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parseQualifiedStoryManifest } from '../lib/frontier/evidence/eligibility';
import { sha256Caption } from '../lib/frontier/evidence/arxivAdapter';

const at = '2026-11-14T19:13:13.373Z';
const script = resolve('scripts/frontier/build-arxiv-story.ts');
const html = resolve('tests/fixtures/frontier/arxiv-synthetic-structure.html');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLhXQAAAABJRU5ErkJggg==',
  'base64',
);
function workspace() {
  return mkdtempSync(join(tmpdir(), 'frontier-arxiv-contract-'));
}
function runBuild(out: string, extras: string[] = []) {
  return spawnSync(process.execPath, [
    '--import', 'tsx', script,
    '--paper-id', '2611.17323v1',
    '--item-id', 'ingest-arxiv-l2kgb2',
    '--html', html, '--observed-at', at, '--built-at', at, '--out', out, ...extras,
  ], { encoding: 'utf8', cwd: process.cwd(), timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
}

test('fully offline build emits atomic private source-only bundle with no fictional figures', () => {
  const dir = workspace();
  try {
    const out = join(dir, 'story-bundle');
    const first = runBuild(out);
    assert.equal(first.status, 0, first.stderr);
    const report = JSON.parse(first.stdout);
    assert.equal(report.sections, 2);
    assert.equal(report.candidateFigures, 2);
    assert.equal(report.approvedFigures, 0);
    const manifest = parseQualifiedStoryManifest(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')));
    assert.equal(manifest.state, 'basic');
    assert.equal(manifest.source.url, 'https://arxiv.org/abs/2611.17323v1');
    assert.equal(manifest.scenes.length, 0);
    assert.equal(readdirSync(join(out, 'assets')).length, 0);
    const provenance = JSON.parse(readFileSync(join(out, 'provenance.json'), 'utf8'));
    assert.match(provenance.htmlSha256, /^[0-9a-f]{64}$/);
    assert.equal(provenance.extractedFigureCandidates, 2);
    assert.equal(provenance.approvedDisplayAssets, 0);

    const duplicate = runBuild(out);
    assert.notEqual(duplicate.status, 0, 'Immutable bundle cannot be silently replaced');
    assert.match(duplicate.stderr, /Refusing to overwrite/);
    assert.equal(readdirSync(dir).length, 1, 'No abandoned staging files after a clean refusal');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verified review binds original caption, rights and actual asset bytes to a figure', () => {
  const dir = workspace();
  try {
    const assetRoot = join(dir, 'reviewed');
    mkdirSync(assetRoot);
    writeFileSync(join(assetRoot, 'approved.png'), png);
    const caption = 'Figure 1: Synthetic demonstration of a source figure and its explanatory caption.';
    const reviews = [{
      sourceUrl: 'https://arxiv.org/html/2611.17323v1#S1.F1',
      imageUrl: 'https://arxiv.org/html/2611.17323v1/x1.png',
      captionSha256: sha256Caption(caption),
      file: 'approved.png',
      rights: {
        display: 'permitted',
        license: 'Synthetic fixture rights',
        attribution: 'Synthetic testing figure, not real research content',
      },
    }];
    const approvalPath = join(dir, 'approvals.json');
    writeFileSync(approvalPath, JSON.stringify(reviews));
    const out = join(dir, 'bundle');
    const result = runBuild(out, ['--approvals', approvalPath, '--asset-root', assetRoot]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = parseQualifiedStoryManifest(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')));
    assert.equal(manifest.scenes.length, 1);
    assert.equal(manifest.scenes[0].type, 'original-figure');
    const digest = createHash('sha256').update(png).digest('hex');
    const assets = JSON.parse(readFileSync(join(out, 'assets.json'), 'utf8'));
    assert.equal(assets[0].key, 'sha256:' + digest);
    assert.equal(assets[0].path, 'assets/' + digest + '.png');
    assert.deepEqual(readFileSync(join(out, assets[0].path)), png);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('approval files cannot escape the declared review directory or publish dangling art', () => {
  const dir = workspace();
  try {
    const root = join(dir, 'reviewed');
    mkdirSync(root);
    const outside = join(dir, 'outside.png');
    writeFileSync(outside, png);
    const approvalPath = join(dir, 'untrusted.json');
    writeFileSync(approvalPath, JSON.stringify([{
      sourceUrl: 'https://arxiv.org/html/2611.17323v1#S1.F1',
      imageUrl: 'https://arxiv.org/html/2611.17323v1/x1.png',
      captionSha256: sha256Caption('Fixture'),
      file: '../outside.png',
      rights: { display: 'permitted', attribution: 'Example', license: 'Example' },
    }]));
    const output = join(dir, 'output');
    const result = runBuild(output, ['--approvals', approvalPath, '--asset-root', root]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /escapes the review directory/);
    assert.equal(existsSync(output), false, 'No partial bundle after review rejection');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the builder never performs dynamic source HTTP requests on first paint', () => {
  const src = readFileSync(script, 'utf8');
  const reader = readFileSync('app/frontier/page.tsx', 'utf8');
  assert.doesNotMatch(src, /fetch\(|https\.request|http\.request|curl\s|wget\s/);
  assert(!reader.includes('build-arxiv-story'));
});
