import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLobsters, parseNasaApod, parseOpenReview, parseRxiv } from '../lib/frontier/expandedSources';

test('bioRxiv parser preserves scientific metadata', () => {
  const items = parseRxiv({
    collection: [{
      doi: '10.1101/2026.08.20.123456',
      title: 'Neural population geometry during behavior',
      authors: 'Ada Example; Ben Example',
      date: '2026-08-20',
      version: '2',
      category: 'neuroscience',
      abstract: 'We characterize neural population geometry across behavior.',
      server: 'bioRxiv',
    }],
  }, 'biorxiv');
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceKind, 'biorxiv');
  assert.equal(items[0]?.authors?.length, 2);
  assert.ok(items[0]?.tags.includes('neuroscience'));
  assert.match(items[0]?.url ?? '', /biorxiv\.org/);
});

test('OpenReview parser supports API v2 wrapped content values', () => {
  const items = parseOpenReview({
    notes: [{
      id: 'note-1',
      forum: 'forum-1',
      tmdate: Date.UTC(2026, 7, 20),
      content: {
        title: { value: 'A Better Retrieval Model' },
        abstract: { value: 'A retrieval benchmark with stronger evaluation.' },
        authors: { value: ['Researcher One', 'Researcher Two'] },
        keywords: { value: ['retrieval', 'evaluation'] },
        venue: { value: 'ICLR 2027' },
      },
    }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceKind, 'openreview');
  assert.equal(items[0]?.authors?.[0], 'Researcher One');
  assert.ok(items[0]?.tags.includes('retrieval'));
  assert.match(items[0]?.url ?? '', /forum-1/);
});

test('Lobsters parser maps discussion momentum and tags', () => {
  const items = parseLobsters([{
    short_id: 'abc123',
    short_id_url: 'https://lobste.rs/s/abc123/example',
    created_at: '2026-08-21T12:00:00.000Z',
    title: 'Building a tiny vector index in the browser',
    url: 'https://example.com/vector-index',
    score: 42,
    comment_count: 18,
    tags: ['web', 'programming'],
    submitter_user: { username: 'alice' },
  }]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceKind, 'lobsters');
  assert.equal(items[0]?.metrics?.find((metric) => metric.label === 'comments')?.value, '18');
  assert.ok((items[0]?.momentum ?? 0) > 0.5);
});

test('NASA APOD uses real source imagery as media', () => {
  const items = parseNasaApod([{
    date: '2026-08-20',
    title: 'A Galactic Arc',
    explanation: 'A real astronomical image and its scientific context.',
    media_type: 'image',
    url: 'https://apod.nasa.gov/image/example.jpg',
    hdurl: 'https://apod.nasa.gov/image/example-hd.jpg',
    copyright: 'Example Observatory',
  }]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceKind, 'nasa');
  assert.equal(items[0]?.media?.type, 'image');
  assert.equal(items[0]?.media?.url, 'https://apod.nasa.gov/image/example-hd.jpg');
  assert.ok(items[0]?.tags.includes('astronomy'));
});
