import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyFrontierLane, parseFrontierRss } from '../lib/frontier/sources';

test('ordinary prose containing acronym substrings cannot become sports metadata', () => {
  const text = 'Chelsea change course with a manager focused on influence, emotional control, and development';
  assert.equal(classifyFrontierLane(text), 'team_pulse');
  assert.notEqual(classifyFrontierLane('Adaptive influence models for long-horizon planning'), 'sports');
});

test('unambiguous full sports phrases still classify without substring-prone acronyms', () => {
  assert.equal(
    classifyFrontierLane('National Football League player tracking and expected points added model'),
    'sports',
  );
});

test('sports competition prose cannot consume the Kaggle competition lane', () => {
  assert.notEqual(
    classifyFrontierLane('Premier League competition returns with Chelsea and Manchester City fighting for the title'),
    'competitions',
  );
  assert.equal(
    classifyFrontierLane('Kaggle machine learning competition winning solution with cross validation and ensembling'),
    'competitions',
  );
});

test('RSS football prose cannot manufacture NFL analytics tags from words such as influence', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title>Chelsea change course with Alonso primed to banish the chaos of youth</title>
    <link>https://www.theguardian.com/football/example</link>
    <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
    <description>The manager wants emotional control and influence over a more stable group after a summer of sensible signings.</description>
  </item></channel></rss>`;

  const [item] = parseFrontierRss(xml, 'theguardian.com');
  assert.ok(item);
  assert.equal(item.lane, 'team_pulse');
  assert.equal(item.tags.includes('nfl'), false);
  assert.equal(item.tags.includes('player tracking'), false);
  assert.equal(item.tags.includes('play-by-play'), false);
  assert.notEqual(item.lane, 'competitions');
});
