import assert from 'node:assert/strict';
import test from 'node:test';
import { extractGoogleTranslation, needsEnglishTranslation } from '../lib/frontier/english';

test('detects clearly non-English script while leaving normal English copy alone', () => {
  assert.equal(needsEnglishTranslation('A new Elden Ring update is live on Steam'), false);
  assert.equal(needsEnglishTranslation('Одна из лучших игр поколения теперь на новой консоли'), true);
  assert.equal(needsEnglishTranslation('新しい研究結果が発表されました'), true);
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
