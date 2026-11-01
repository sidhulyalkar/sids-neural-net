import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertQualifiedFrontierArchive,
  buildFrontierDiscoveryLedger,
  frontierDiscoveryIdentity,
} from '../lib/frontier/discoveryLedger';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceKind } from '../lib/frontier/types';

const now = '2026-11-01T17:00:00.000Z';
const item = (id: string, sourceKind: FrontierSourceKind, offsetHours = 2): FrontierItem => ({
  id,
  title: 'Measured publication ' + id,
  summary: 'An evidence-based research result.',
  url: 'https://example.org/studies/' + encodeURIComponent(id),
  source: 'example.org',
  sourceLabel: sourceKind,
  sourceKind,
  publishedAt: new Date(Date.parse(now) - offsetHours * 3_600_000).toISOString(),
  tags: ['research'],
  lane: 'ai_frontier',
  baseScore: .8, importance: .8, novelty: .75, quality: .85, momentum: .6,
});
const feed = (items: FrontierItem[], ok = true): FrontierFeedResponse => ({
  generatedAt: now,
  items,
  sources: [
    { id: 'arxiv', label: 'arXiv', ok, count: ok ? 4 : 0 },
    { id: 'rss', label: 'RSS', ok: true, count: 4 },
  ],
});
const editorial = () => [
  item('paper-1', 'arxiv'),
  item('paper-2', 'arxiv'),
  item('paper-3', 'arxiv'),
  item('story-1', 'rss'),
  item('story-2', 'rss'),
  item('story-3', 'rss'),
  item('story-4', 'rss'),
  item('story-5', 'rss'),
];

test('hash identity is stable across UTM parameters but no raw URL is stored', () => {
  const entry = item('one', 'arxiv');
  const a = frontierDiscoveryIdentity(entry);
  const b = frontierDiscoveryIdentity({ ...entry, url: entry.url + '?utm_source=frontier&ref=homepage' });
  assert.equal(a, b);
  assert.match(a!, /^[a-f0-9]{32}$/);
  assert.equal(frontierDiscoveryIdentity({ ...entry, url: 'file:///etc/passwd' }), null);
  assert.equal(frontierDiscoveryIdentity({ ...entry, url: 'https://name:password@example.org/a' }), null);
  const ledger = buildFrontierDiscoveryLedger(feed([entry]));
  assert.equal(JSON.stringify(ledger).includes(entry.title), false);
  assert.equal(JSON.stringify(ledger).includes(entry.url), false);
});

test('a repeated source article is not new; an edited summary is a revision', () => {
  const first = buildFrontierDiscoveryLedger(feed(editorial()));
  assert.equal(first.latest.discovered, 8);
  assert.equal(first.latest.editorialNew, 8);
  assert.equal(first.latest.revised, 0);
  assert.equal(first.sources.arxiv.lastSuccessAt, now);
  const second = buildFrontierDiscoveryLedger(feed(editorial()), first);
  assert.equal(second.latest.discovered, 0);
  assert.equal(second.latest.unchanged, 8);
  const original = editorial()[0];
  const modified = { ...original, summary: 'A corrected, source-backed finding.' };
  const third = buildFrontierDiscoveryLedger(feed([modified, ...editorial().slice(1)]), second);
  assert.equal(third.latest.discovered, 0);
  assert.equal(third.latest.revised, 1);
  assert.equal(third.sources.arxiv.revised, 1);
  assert.equal(third.sources.arxiv.newlyObserved, 0);
  const key = frontierDiscoveryIdentity(original)!;
  assert.equal(third.entries[key].firstSeenAt, first.entries[key].firstSeenAt);
  assert.equal(third.entries[key].firstPublishedAt, first.entries[key].firstPublishedAt);
  assert.equal(third.entries[key].lastContentChangedAt, now);
  assert.equal(third.entries[key].lastSeenAt, now);
});

test('source failure retains previous success checkpoint and never fabricates one', () => {
  const first = buildFrontierDiscoveryLedger(feed(editorial()));
  const failureFeed = feed(editorial().filter((entry) => entry.sourceKind === 'rss'), false);
  failureFeed.generatedAt = '2026-11-01T18:00:00.000Z';
  const second = buildFrontierDiscoveryLedger(failureFeed, first);
  assert.equal(second.sources.arxiv.consecutiveFailures, 1);
  assert.equal(second.sources.arxiv.lastSuccessAt, now);
  assert.equal(second.sources.arxiv.lastAttemptAt, failureFeed.generatedAt);
  assert.equal(second.latest.discovered, 0);
  assert.equal(second.entries[frontierDiscoveryIdentity(item('paper-1', 'arxiv'))!].lastSeenAt, now);
  const restored = buildFrontierDiscoveryLedger({
    ...feed(editorial()),
    generatedAt: '2026-11-01T19:00:00.000Z',
  }, second);
  assert.equal(restored.sources.arxiv.consecutiveFailures, 0);
  assert.equal(restored.sources.arxiv.lastSuccessAt, '2026-11-01T19:00:00.000Z');
});

test('sports scores and one working source cannot qualify a replacement snapshot', () => {
  const good = feed(editorial());
  assert.doesNotThrow(() => assertQualifiedFrontierArchive(good, Date.parse(now)));
  const singleSource = feed(editorial().map((entry) => ({ ...entry, sourceKind: 'arxiv' })));
  assert.throws(() => assertQualifiedFrontierArchive(singleSource, Date.parse(now)), /insufficient fresh editorial/);
  const sports = feed(editorial().map((entry) => ({
    ...entry, sourceKind: 'sports_state' as const,
  })));
  assert.throws(() => assertQualifiedFrontierArchive(sports, Date.parse(now)), /insufficient fresh editorial/);
  const tooOld = feed(editorial().map((entry, i) => ({ ...entry, publishedAt: new Date(Date.parse(now) - (i + 15) * 86_400_000).toISOString() })));
  assert.throws(() => assertQualifiedFrontierArchive(tooOld, Date.parse(now)), /insufficient fresh editorial/);
});

test('malformed ledger state is not trusted and oversized history is bounded', () => {
  const out = buildFrontierDiscoveryLedger(feed(editorial()), { version: 100, entries: { invalid: {} }, sources: {} });
  assert.equal(out.latest.discovered, 8);
  assert.equal(out.latest.retained, 8);
  const malformed = buildFrontierDiscoveryLedger(feed(editorial()), {
    ...out,
    entries: { ...out.entries, xyz: { lastSeenAt: now, contentDigest: 'unsafe' } },
  });
  assert.equal(Object.hasOwn(malformed.entries, 'xyz'), false);
});
