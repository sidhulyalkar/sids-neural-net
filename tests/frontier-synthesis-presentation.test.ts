import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierSynthesisInputSignature,
  frontierSynthesisPresentationItems,
} from '../lib/frontier/synthesis/presentationState';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, title = id): FrontierItem {
  return {
    id,
    title,
    summary: `Grounded summary for ${title}`,
    url: `https://example.invalid/${id}`,
    source: 'example.invalid',
    sourceLabel: 'Fixture',
    sourceKind: 'rss',
    publishedAt: '2026-08-22T00:00:00.000Z',
    lane: 'ai_frontier',
    tags: ['audit'],
    baseScore: 0.9,
    importance: 0.9,
    novelty: 0.8,
    quality: 0.9,
    momentum: 0.5,
  };
}

test('stale async synthesis can never hide a newer source-backed item set', () => {
  const previous = [item('old')];
  const current = [item('new-1'), item('new-2')];
  const resolved = frontierSynthesisPresentationItems(
    current,
    frontierSynthesisInputSignature(current),
    {
      inputSignature: frontierSynthesisInputSignature(previous),
      items: previous,
    },
    true,
  );

  assert.deepEqual(resolved.map((entry) => entry.id), ['new-1', 'new-2']);
});

test('matching synthesis may replace the current presentation with enriched output', () => {
  const current = [item('source')];
  const enriched = [{ ...current[0], title: 'Enriched source presentation' }];
  const signature = frontierSynthesisInputSignature(current);

  const resolved = frontierSynthesisPresentationItems(
    current,
    signature,
    { inputSignature: signature, items: enriched },
    true,
  );

  assert.equal(resolved[0].title, 'Enriched source presentation');
});

test('disabled synthesis always returns deterministic current items', () => {
  const current = [item('current')];
  const stale = [item('stale')];
  const resolved = frontierSynthesisPresentationItems(
    current,
    frontierSynthesisInputSignature(current),
    { inputSignature: frontierSynthesisInputSignature(stale), items: stale },
    false,
  );

  assert.deepEqual(resolved, current);
});
