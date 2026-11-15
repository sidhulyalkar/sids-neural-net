import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sourcePreview } from '../lib/frontier/evidence/sourcePreview';

test('the real AgentSSL snapshot excerpt becomes a complete, source-authored editorial lead', () => {
  const snapshot = JSON.parse(readFileSync('content/frontier/latest.json', 'utf8'));
  const paper = snapshot.items.find((item: { id: string }) =>
    item.id === 'ingest-arxiv-l2kgb2');
  assert(paper?.summary, 'The frozen pilot paper must exist');
  assert(paper.summary.endsWith('performance drop'), 'Source excerpt is genuinely truncated');
  const preview = sourcePreview(paper.summary);
  assert(preview);
  assert(preview.endsWith('abundant.'), 'Only the first two source-complete sentences fit');
  assert(preview.length <= 430);
  assert(!preview.includes('performance drop'), 'Never present an incomplete claim as a conclusion');
  assert(paper.summary.startsWith(preview.slice(0, 100)));
});

test('source leads never silently rephrase or complete incomplete findings', () => {
  assert.equal(sourcePreview('This is an incomplete source fragment'), null);
  assert.equal(sourcePreview('This is complete. The results were reported as'), 'This is complete.');
  assert.equal(sourcePreview('A result is reported. B is documented.', 120),
    'A result is reported. B is documented.');
  assert.equal(sourcePreview(' A question?  A tested answer!   Residual fragment'), 'A question? A tested answer!');
  assert.equal(sourcePreview(undefined), null);
  assert.equal(sourcePreview('Short. Full sentence.', 60), null);
});

test('the new source-only visual mode stays isolated from figure-rich research stories and global sensing', () => {
  const reader = readFileSync('components/frontier/evidence/FrontierEvidenceStory.tsx', 'utf8');
  const css = readFileSync('components/frontier/evidence/frontier-evidence-story.module.css', 'utf8');
  const sensing = readFileSync('components/sensing/InteractionCapabilityProvider.tsx', 'utf8');
  assert.match(reader, /sourcePreview\(summary\)/);
  assert.match(reader, /figures\.length === 0 \? styles\.storyGridSourceOnly/);
  assert.match(reader, /No approved figures yet/);
  assert.match(css, /\.storyGridSourceOnly \.emptyStage/);
  assert.match(sensing, /pathname\?\.startsWith\('\/frontier\/story\/'\)/);
  assert.match(sensing, /pathname === '\/frontier\/evidence-audit'/);
  assert.match(sensing, /isArcadeGamePath\(pathname\)/, 'Game isolation must remain intact');
});
