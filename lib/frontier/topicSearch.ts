import type { FrontierItem } from './types';

const MAX_QUERY_LENGTH = 96;
const MAX_FOCUS_TERMS = 8;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'for', 'from', 'in', 'into', 'is', 'of', 'on', 'or', 'the', 'to', 'with',
  'about', 'latest', 'new', 'news', 'updates', 'interesting',
]);

export function normalizeTopicSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

export function searchTokens(value: string): string[] {
  const normalized = normalizeTopicSearch(value).toLowerCase();
  if (!normalized) return [];
  return Array.from(new Set(
    normalized
      .replace(/[^a-z0-9+#. -]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
  )).slice(0, 10);
}

export function buildTopicSearchFocus(query: string, adaptiveFocus: string[], limit = MAX_FOCUS_TERMS): string[] {
  const normalized = normalizeTopicSearch(query).toLowerCase();
  const seen = new Set<string>();
  const output: string[] = [];
  const add = (value: string) => {
    const next = normalizeTopicSearch(value).toLowerCase();
    if (!next || seen.has(next) || output.length >= Math.max(1, Math.min(limit, MAX_FOCUS_TERMS))) return;
    seen.add(next);
    output.push(next);
  };
  if (normalized) add(normalized);
  for (const topic of adaptiveFocus) add(topic);
  return output;
}

export function topicSearchScore(item: FrontierItem, query: string): number {
  const normalized = normalizeTopicSearch(query).toLowerCase();
  if (!normalized) return 1;
  const tokens = searchTokens(normalized);
  if (!tokens.length) return 0;

  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const tags = item.tags.join(' ').toLowerCase();
  const source = `${item.sourceLabel} ${item.source}`.toLowerCase();
  let score = 0;

  if (title.includes(normalized)) score += 12;
  if (tags.includes(normalized)) score += 8;
  if (summary.includes(normalized)) score += 5;

  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (tags.includes(token)) score += 3;
    if (summary.includes(token)) score += 1.5;
    if (source.includes(token)) score += 0.5;
  }
  return score;
}

export function topicSearchMatches(item: FrontierItem, query: string): boolean {
  return topicSearchScore(item, query) > 0;
}
