import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGdeltArticles } from '../lib/frontier/liveDiscovery';

test('GDELT live discovery keeps real source media and limits one domain from flooding results', () => {
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
  assert.ok(items[0].quality > 0.85);
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
});
