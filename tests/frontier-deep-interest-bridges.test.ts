import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_TASTE_DISCOVERY_QUERIES } from '../lib/frontier/personalTaste';
import {
  FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES,
  pickDailyTasteQueries,
} from '../lib/frontier/personalTasteSources';

const BRIDGE_TAG = 'connection discovery';

function day(offset: number): string {
  const date = new Date(Date.UTC(2026, 7, 1 + offset));
  return date.toISOString().slice(0, 10);
}

test('deep personal discovery keeps the eight-search budget while reserving exactly one bridge slot', () => {
  const picked = pickDailyTasteQueries('2026-08-29');
  assert.equal(picked.length, 8);
  assert.deepEqual(picked.slice(0, 4), FRONTIER_TASTE_DISCOVERY_QUERIES.slice(0, 4));
  assert.equal(picked.filter((query) => query.tags.includes(BRIDGE_TAG)).length, 1);
  assert.equal(picked.slice(4).filter((query) => !query.tags.includes(BRIDGE_TAG)).length, 3);
});

test('bridge probes are true intersections rather than standalone hobby searches', () => {
  assert.ok(FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES.length >= 6);
  for (const bridge of FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES) {
    assert.ok(bridge.query.startsWith('site:github.com '));
    assert.ok(bridge.tags.includes(BRIDGE_TAG));
    assert.ok(bridge.tags.includes('open source'));
    assert.ok(bridge.tags.length >= 4);
  }
});

test('bridge and ordinary deep-discovery slots both rotate across days', () => {
  const bridgeQueries = new Set<string>();
  const ordinaryQueries = new Set<string>();

  for (let offset = 0; offset < 32; offset += 1) {
    const picked = pickDailyTasteQueries(day(offset));
    const bridges = picked.filter((query) => query.tags.includes(BRIDGE_TAG));
    assert.equal(bridges.length, 1);
    bridgeQueries.add(bridges[0].query);
    for (const query of picked.slice(4).filter((entry) => !entry.tags.includes(BRIDGE_TAG))) {
      ordinaryQueries.add(query.query);
    }
  }

  assert.ok(bridgeQueries.size >= 4);
  assert.ok(ordinaryQueries.size >= 8);
});

test('small deep-discovery limits preserve the four pinned anchors without inventing extra fanout', () => {
  assert.equal(pickDailyTasteQueries('2026-08-29', 4).length, 4);
  assert.deepEqual(
    pickDailyTasteQueries('2026-08-29', 4),
    FRONTIER_TASTE_DISCOVERY_QUERIES.slice(0, 4),
  );
  assert.equal(pickDailyTasteQueries('2026-08-29', 5).length, 5);
  assert.equal(pickDailyTasteQueries('2026-08-29', 5)[4].tags.includes(BRIDGE_TAG), true);
});
