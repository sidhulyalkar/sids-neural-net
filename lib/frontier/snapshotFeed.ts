import frontierSnapshot from '@/content/frontier/latest.json';
import { needsEnglishTranslation } from './english';
import { vetFrontierItems } from './sourceTrust';
import type { FrontierFeedResponse, FrontierItem } from './types';

const DAY_MS = 86_400_000;
const MAX_FUTURE_SKEW_MS = 12 * 60 * 60_000;
const MAX_SNAPSHOT_CANDIDATES = 320;

function plausible(item: FrontierItem, now: number): boolean {
  if (!item.title?.trim()) return false;
  const publishedAt = Date.parse(item.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > now + MAX_FUTURE_SKEW_MS) return false;
  try {
    const url = new URL(item.url);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function rightsFragileNflYoutube(item: FrontierItem): boolean {
  if (item.sourceKind !== 'youtube' && item.media?.type !== 'youtube') return false;
  const text = [item.title, item.summary, item.sourceLabel, ...item.tags].join(' ').toLowerCase();
  return /\bnfl\b|new england patriots|patriots/.test(text);
}

function canonicalKey(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) url.searchParams.delete(key);
    return url.toString().toLowerCase();
  } catch {
    return item.title.toLowerCase().replace(/\W+/g, ' ').trim();
  }
}

function dedupe(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const urlKey = canonicalKey(item);
    const titleKey = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(urlKey) || seen.has(titleKey)) return false;
    seen.add(urlKey);
    seen.add(titleKey);
    return true;
  });
}

/**
 * Cold navigation has a deliberately tiny authority surface. The committed
 * archive was produced by the full discovery pipeline and qualified by CI, so a
 * passive request only rechecks properties that can become invalid with time or
 * current policy: age, URL plausibility, rights-sensitive NFL YouTube material,
 * English readability, dedupe, and source trust.
 *
 * Crucially this module imports no live adapters, discovery meshes, sports
 * transports, or personal search machinery. The browser can paint the qualified
 * snapshot without paying to initialize the Internet-discovery graph first.
 */
export function getFrontierColdSnapshotFeed(now = Date.now()): FrontierFeedResponse {
  const snapshot = frontierSnapshot as FrontierFeedResponse;
  const recent = (snapshot.items ?? []).filter((item) => {
    if (!plausible(item, now) || rightsFragileNflYoutube(item)) return false;
    const publishedAt = Date.parse(item.publishedAt);
    const ageDays = (now - publishedAt) / DAY_MS;
    if (!Number.isFinite(ageDays) || ageDays > 10) return false;
    return !needsEnglishTranslation(item.title) && !needsEnglishTranslation(item.summary);
  });

  const items = vetFrontierItems(dedupe(recent)).slice(0, MAX_SNAPSHOT_CANDIDATES);
  return {
    generatedAt: snapshot.generatedAt || new Date(now).toISOString(),
    items,
    sources: Array.isArray(snapshot.sources) ? snapshot.sources : [],
  };
}
