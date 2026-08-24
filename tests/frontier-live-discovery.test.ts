import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_SOURCE_WEIGHTS } from '../lib/frontier/config';
import { parseGdeltArticles } from '../lib/frontier/liveDiscovery';
import { assessFrontierHost } from '../lib/frontier/sourceTrust';

test('GDELT live discovery keeps real source media, central trust, and per-domain diversity', () => {
  const items = parseGdeltArticles({
    articles: [
      {
        url: 'https://www.reuters.com/world/example-1',
        title: 'Mountain biking championship announces a new course',
        seendate: '20260821T183000Z',
        socialimage: 'https://www.reuters.com/image.jpg',
        domain: 'reuters.com',
        language: 'English',
      },
      {
        url: 'https://www.reuters.com/world/example-2',
        title: 'Mountain biking final produces a surprise winner',
        seendate: '20260821T184000Z',
        domain: 'reuters.com',
      },
      {
        url: 'https://www.reuters.com/world/example-3',
        title: 'A third repetitive result from the same publisher',
        seendate: '20260821T185000Z',
        domain: 'reuters.com',
      },
    ],
  }, 'mountain biking');

  assert.equal(items.length, 2);
  assert.equal(items[0].sourceKind, 'gdelt');
  assert.equal(items[0].sourceLabel, 'reuters.com');
  assert.equal(items[0].media?.type, 'image');
  assert.equal(items[0].summary, '');

  const expectedQuality = assessFrontierHost('reuters.com').score * FRONTIER_SOURCE_WEIGHTS.gdelt;
  assert.ok(Math.abs(items[0].quality - expectedQuality) < 1e-9);
  assert.equal(assessFrontierHost('reuters.com').tier, 'established');
  assert.ok(items[0].tags.includes('mountain biking'));
});

test('GDELT parser never invents an article body when the API only supplies a title', () => {
  const [item] = parseGdeltArticles({
    articles: [{
      url: 'https://example.org/story',
      title: 'A real headline from the live source',
      domain: 'example.org',
      seendate: '20260821T190000Z',
    }],
  }, 'neuroai');

  assert.equal(item.title, 'A real headline from the live source');
  assert.equal(item.summary, '');
  assert.match(item.why ?? '', /Live web discovery/);
  assert.equal(assessFrontierHost('example.org').tier, 'unknown');
  assert.ok(item.quality < 0.4, 'unknown publisher quality must stay weak before the central admission gate rejects it');
});
