import type { FrontierItem } from './types';

const NON_LATIN_SCRIPT = /[\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}]/gu;
const ACCENTED_LATIN = /[à-ž]/giu;
const TRANSLATE_TIMEOUT_MS = 2600;

const FOREIGN_HINTS = new Set([
  // Spanish / Portuguese / Italian
  'para', 'pero', 'como', 'esta', 'este', 'estos', 'estas', 'una', 'uno', 'unos', 'unas', 'del', 'desde', 'sobre', 'nuevo', 'nueva',
  'mais', 'com', 'uma', 'novo', 'nova', 'agora', 'della', 'delle', 'degli', 'nuovo', 'nuova', 'anche',
  // French
  'avec', 'dans', 'pour', 'une', 'des', 'les', 'est', 'sur', 'nouveau', 'nouvelle', 'mais', 'après', 'avant',
  // German / Dutch
  'und', 'der', 'die', 'das', 'mit', 'für', 'auf', 'ist', 'neue', 'neuer', 'neues', 'ein', 'eine',
  'het', 'een', 'voor', 'van', 'nieuwe', 'met',
  // Polish / Turkish
  'jest', 'dla', 'oraz', 'nowy', 'nowa', 'przez', 'ile', 'bir', 'için', 'ile', 'yeni', 'olan',
]);

const ENGLISH_HINTS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'with', 'from', 'in', 'on', 'is', 'are', 'new', 'now', 'after', 'before', 'this', 'that',
]);

function latinLanguageLooksForeign(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 4) return false;

  const foreign = tokens.reduce((count, token) => count + Number(FOREIGN_HINTS.has(token)), 0);
  const english = tokens.reduce((count, token) => count + Number(ENGLISH_HINTS.has(token)), 0);
  const accented = text.match(ACCENTED_LATIN)?.length ?? 0;
  const punctuationHint = /[¿¡]/.test(text);

  return foreign >= 2 && english === 0 || foreign >= 1 && (accented >= 2 || punctuationHint) && english <= 1;
}

export function needsEnglishTranslation(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  const matches = text.match(NON_LATIN_SCRIPT)?.length ?? 0;
  if (matches >= 2 && matches / Math.max(1, text.length) > 0.025) return true;
  return latinLanguageLooksForeign(text);
}

export function extractGoogleTranslation(payload: unknown): string | undefined {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return undefined;
  const translated = payload[0]
    .flatMap((chunk) => Array.isArray(chunk) && typeof chunk[0] === 'string' ? [chunk[0]] : [])
    .join('')
    .trim();
  return translated || undefined;
}

async function translateText(value: string): Promise<string | undefined> {
  if (!needsEnglishTranslation(value)) return value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', 'en');
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', value.slice(0, 4200));
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!response.ok) return undefined;
    return extractGoogleTranslation(await response.json());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateItem(item: FrontierItem): Promise<FrontierItem | null> {
  const translateTitle = needsEnglishTranslation(item.title);
  const translateSummary = needsEnglishTranslation(item.summary);
  if (!translateTitle && !translateSummary) return item;

  const [title, summary] = await Promise.all([
    translateTitle ? translateText(item.title) : Promise.resolve(item.title),
    translateSummary ? translateText(item.summary) : Promise.resolve(item.summary),
  ]);

  // The visible product promise is English-only. If translation is unavailable,
  // omit the item rather than leaking a language-changing card into the feed.
  if (!title || !summary || needsEnglishTranslation(title) || needsEnglishTranslation(summary)) return null;

  return {
    ...item,
    title,
    summary,
    tags: Array.from(new Set([...item.tags, 'translated to english'])).slice(0, 9),
    why: item.why ? `${item.why} Visible copy translated to English.` : 'Visible copy translated to English.',
  };
}

export async function normalizeFeedToEnglish(items: FrontierItem[]): Promise<FrontierItem[]> {
  const output: FrontierItem[] = [];
  const concurrency = 5;
  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    const translated = await Promise.all(batch.map(translateItem));
    output.push(...translated.filter((item): item is FrontierItem => Boolean(item)));
  }
  return output;
}
