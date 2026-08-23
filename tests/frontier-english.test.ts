import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractGoogleTranslation,
  FRONTIER_MAX_TRANSLATED_ITEMS_PER_FEED,
  frontierTranslationCandidateIndexes,
  needsEnglishTranslation,
} from '../lib/frontier/english';

test('detects clearly non-English script while leaving normal English copy alone', () => {
  assert.equal(needsEnglishTranslation('A new Elden Ring update is live on Steam'), false);
  assert.equal(needsEnglishTranslation('Rock climber Janja Garnbret wins another dramatic final'), false);
  assert.equal(needsEnglishTranslation('Одна из лучших игр поколения теперь на новой консоли'), true);
  assert.equal(needsEnglishTranslation('新しい研究結果が発表されました'), true);
});

test('detects common Latin-script foreign-language feed copy', () => {
  assert.equal(needsEnglishTranslation('Una nueva actualización para el juego está disponible ahora'), true);
  assert.equal(needsEnglishTranslation('Le nouveau jeu est maintenant disponible avec une grande mise à jour'), true);
  assert.equal(needsEnglishTranslation('Die neue Version ist jetzt mit einem großen Update verfügbar'), true);
  assert.equal(needsEnglishTranslation('A café in Montréal hosts a new climbing film night'), false);
});

test('extracts translated fragments from the translation response shape', () => {
  const payload = [
    [
      ['One of the best games of the generation ', 'Одна из лучших игр поколения ', null, null],
      ['is now on the new console', 'теперь на новой консоли', null, null],
    ],
    null,
    'ru',
  ];
  assert.equal(extractGoogleTranslation(payload), 'One of the best games of the generation is now on the new console');
});

test('request-time translation candidates remain bounded and preserve feed order', () => {
  const english = { title: 'Fresh machine learning benchmark', summary: 'A grounded English summary.' };
  const foreign = Array.from({ length: FRONTIER_MAX_TRANSLATED_ITEMS_PER_FEED + 5 }, (_, index) => ({
    title: `新しい研究結果が発表されました ${index}`,
    summary: '研究の概要です',
  }));
  const items = [english, ...foreign.slice(0, 4), english, ...foreign.slice(4)];
  const indexes = frontierTranslationCandidateIndexes(items);

  assert.equal(indexes.length, FRONTIER_MAX_TRANSLATED_ITEMS_PER_FEED);
  assert.deepEqual(indexes.slice(0, 5), [1, 2, 3, 4, 6]);
  assert(indexes.every((index, position) => position === 0 || index > indexes[position - 1]));
});
