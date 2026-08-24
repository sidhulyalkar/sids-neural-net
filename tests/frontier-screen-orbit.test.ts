import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { migrateFrontierProfile } from '../lib/frontier/profileMigration';
import { personalTasteRankingPrior } from '../lib/frontier/personalTaste';
import { selectDailyRun } from '../lib/frontier/scoring';
import {
  FRONTIER_ANIME_FAVORITES,
  FRONTIER_NETFLIX_SCREEN_FAVORITES,
  FRONTIER_SCREEN_FAVORITES,
  matchedScreenFavorites,
  screenTastePrior,
  screenTasteTags,
} from '../lib/frontier/screenTaste';
import { parseScreenNewsRss, screenDiscoveryQueries } from '../lib/frontier/screenSources';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import type { FrontierItem, FrontierProfile } from '../lib/frontier/types';

function item(id: string, title: string, lane: FrontierItem['lane'] = 'screen', tags: string[] = []): FrontierItem {
  return {
    id,
    title,
    summary: title,
    url: `https://www.crunchyroll.com/news/${id}`,
    source: 'crunchyroll.com',
    sourceLabel: 'Crunchyroll News',
    sourceKind: 'rss',
    publishedAt: '2026-08-24T05:00:00.000Z',
    lane,
    tags,
    baseScore: 0.65,
    importance: 0.58,
    novelty: 0.58,
    quality: 0.75,
    momentum: 0.5,
  };
}

test('screen catalog preserves the complete supplied anime and Netflix lists', () => {
  assert.equal(FRONTIER_ANIME_FAVORITES.length, 43);
  assert.equal(FRONTIER_NETFLIX_SCREEN_FAVORITES.length, 48);
  assert.equal(FRONTIER_SCREEN_FAVORITES.length, 87);
  for (const title of [
    'Re:ZERO -Starting Life in Another World-',
    "Frieren: Beyond Journey's End",
    'JUJUTSU KAISEN',
    'DAN DA DAN',
    'The Apothecary Diaries',
    'Solo Leveling',
    'Attack on Titan',
    'BoJack Horseman',
    'Inside Job',
    'Arrested Development',
    'Black Mirror',
    'The Midnight Gospel',
    'Murderville',
  ]) assert.ok(FRONTIER_SCREEN_FAVORITES.includes(title), title);
});

test('exact favorites resolve into distinct story and humor motifs', () => {
  const frieren = screenTasteTags('Frieren season news and trailer');
  assert.ok(frieren.includes('anime'));
  assert.ok(frieren.includes('fantasy progression'));
  assert.ok(frieren.includes('strong worldbuilding'));
  assert.ok(frieren.includes('screen favorite'));

  const bojack = screenTasteTags('BoJack Horseman creator discusses a new animated series');
  assert.ok(bojack.includes('animated dark comedy'));
  assert.ok(bojack.includes('screen favorite'));

  const blackMirror = screenTasteTags('Black Mirror returns with a psychological mystery story');
  assert.ok(blackMirror.includes('mystery psychological'));
  assert.ok(blackMirror.includes('story rich'));
});

test('aliases match stylized anime titles while ambiguous entertainment titles require context', () => {
  assert.deepEqual(matchedScreenFavorites('Dandadan announces a new season'), ['DAN DA DAN']);
  assert.ok(matchedScreenFavorites('JJK movie update').includes('JUJUTSU KAISEN'));
  assert.equal(matchedScreenFavorites('A chef explains how to cook beef stock').includes('BEEF'), false);
  assert.equal(matchedScreenFavorites('Netflix BEEF series season update').includes('BEEF'), true);
  assert.ok(screenTastePrior('new dark fantasy anime with strong worldbuilding') < screenTastePrior('Frieren season 3'));
});

test('screen taste participates in the same personalized prior as technical and sports interests', () => {
  const exact = item('frieren', 'Frieren season 3 trailer and premiere update', 'screen', ['anime', 'frieren']);
  const adjacent = item('adjacent', 'New dark fantasy anime builds a strange world', 'screen', ['anime', 'strong worldbuilding']);
  assert.ok(personalTasteRankingPrior(exact) >= 0.14);
  assert.ok(personalTasteRankingPrior(adjacent) > 0.05);
  assert.ok(personalTasteRankingPrior(exact) > personalTasteRankingPrior(adjacent));
});

test('production-sized daily run reserves Screen Orbit independently of gaming and internet culture', () => {
  const at = new Date('2026-08-24T06:00:00.000Z');
  const screenCard = item('screen-isolated', 'Re:ZERO anniversary and season update', 'screen', ['anime', 're zero']);
  const importantCard = item('important', 'Major security release', 'must_know', ['security']);

  assert.equal(screenCard.lane, 'screen');
  assert.match(
    selectDailyRun.toString(),
    /isScreenOrbitSignal|lane\s*===\s*["']screen["']/,
    `Runtime selectDailyRun lacks a Screen Orbit reservation: ${selectDailyRun.toString()}`,
  );

  const screenOnly = selectDailyRun([screenCard], {}, 14, at);
  assert.deepEqual(
    screenOnly.map((entry) => entry.id),
    ['screen-isolated'],
    `Single Screen Orbit card was not selected: [${screenOnly.map((entry) => `${entry.id}:${entry.lane}`).join(', ')}]`,
  );

  const screenPlusImportant = selectDailyRun([importantCard, screenCard], {}, 14, at);
  assert.ok(
    screenPlusImportant.some((entry) => entry.id === 'screen-isolated'),
    `Screen Orbit disappeared beside Must Know: [${screenPlusImportant.map((entry) => `${entry.id}:${entry.lane}`).join(', ')}]`,
  );

  // Use a fresh object here so any accidental selection-time mutation of the
  // isolated probe above cannot make the production-sized assertion ambiguous.
  const productionScreenCard = item('screen', 'Re:ZERO anniversary and season update', 'screen', ['anime', 're zero']);
  const ranked = [
    importantCard,
    item('learn', 'Neural decoding benchmark', 'neuro_frontier', ['neural decoding']),
    item('game', 'New metroidvania release', 'gaming', ['metroidvania']),
    item('internet', 'Funny internet clip', 'internet_culture', ['meme']),
    productionScreenCard,
    ...Array.from({ length: 16 }, (_, index) => item(`filler-${index}`, `Filler ${index}`, 'wildcards', [`filler-${index}`])),
  ];
  const selected = selectDailyRun(ranked, {}, 14, at);
  const diagnostic = selected.map((entry) => `${entry.id}:${entry.lane}`).join(', ');
  assert.ok(selected.some((entry) => entry.id === 'screen'), `Screen Orbit missing from [${diagnostic}]`);
  assert.ok(selected.some((entry) => entry.id === 'game'), `Gaming missing from [${diagnostic}]`);
});

test('Screen Orbit motif RSS requires returned evidence rather than query labels', () => {
  const spec = screenDiscoveryQueries('2026-08-24').find((query) => query.id === 'story-anime');
  assert.ok(spec);
  const rss = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Re:ZERO anime reveals a new anniversary visual</title>
      <link>https://news.google.com/rss/articles/rezero</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <source url="https://www.crunchyroll.com/news/latest">Crunchyroll News</source>
      <description>Fresh official anime update.</description>
    </item>
    <item>
      <title>Generic television industry accounting update</title>
      <link>https://news.google.com/rss/articles/accounting</link>
      <pubDate>Sun, 23 Aug 2026 17:00:00 GMT</pubDate>
      <source url="https://unknown-screen-blog.invalid">Unknown Blog</source>
      <description>Quarterly accounting details and unrelated distribution metrics.</description>
    </item>
  </channel></rss>`;
  const parsed = parseScreenNewsRss(rss, spec!, Date.parse('2026-08-24T06:00:00Z'));
  assert.equal(parsed.length, 1);
  const favorite = parsed[0];
  assert.equal(favorite.lane, 'screen');
  assert.ok(favorite.tags.includes('screen favorite'));
  assert.ok(favorite.tags.includes('anime'));
  assert.equal(isFrontierSourceAdmitted(favorite), true);
});

test('rotating favorite-title searches discard fuzzy results that never mention a favorite', () => {
  const spec = screenDiscoveryQueries('2026-08-24').find((query) => query.id.startsWith('favorites-'));
  assert.ok(spec);
  const rss = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Streaming platforms publish quarterly release calendars</title>
      <link>https://news.google.com/rss/articles/generic-release</link>
      <pubDate>Sun, 23 Aug 2026 18:00:00 GMT</pubDate>
      <source url="https://variety.com/tv/news/">Variety</source>
      <description>General entertainment news without any title from the requested bundle.</description>
    </item>
  </channel></rss>`;
  assert.deepEqual(parseScreenNewsRss(rss, spec!, Date.parse('2026-08-24T06:00:00Z')), []);
});

test('profile migration backfills Screen Orbit lane and broad motifs without overriding negatives', () => {
  const current = createInitialProfile();
  const laneAffinity = { ...current.laneAffinity } as Record<string, number>;
  delete laneAffinity.screen;
  const topicAffinity = { ...current.topicAffinity };
  delete topicAffinity.anime;
  topicAffinity['witty dark comedy'] = -0.5;
  const legacy = {
    ...current,
    laneAffinity,
    topicAffinity,
    meaningfulInteractions: 40,
  } as unknown as FrontierProfile;
  const migrated = migrateFrontierProfile(legacy);
  assert.ok((migrated.laneAffinity.screen ?? 0) > 0);
  assert.ok((migrated.topicAffinity.anime ?? 0) > 0.3);
  assert.equal(migrated.topicAffinity['witty dark comedy'], -0.5);
});
