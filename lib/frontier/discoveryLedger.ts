import { createHash } from 'node:crypto';
import { frontierHasUsableRecentFeed } from './liveFeedPolicy';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceKind } from './types';

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 60;
const MAX_ENTRIES = 4_000;
const MAX_SOURCES = 48;

export type FrontierDiscoveryLedgerEntry = {
  sourceKind: FrontierSourceKind;
  /** Stable identity is a digest of the public canonical URL, not a title or visitor query. */
  firstSeenAt: string;
  lastSeenAt: string;
  firstPublishedAt: string;
  lastPublishedAt: string;
  lastContentChangedAt: string;
  contentDigest: string;
  editorial: boolean;
};

export type FrontierDiscoverySourceCheckpoint = {
  lastAttemptAt: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  lastReportedCount: number;
  newlyObserved: number;
  revised: number;
  editorialNew: number;
};

export type FrontierDiscoveryLedger = {
  version: 1;
  generatedAt: string;
  entries: Record<string, FrontierDiscoveryLedgerEntry>;
  sources: Record<string, FrontierDiscoverySourceCheckpoint>;
  latest: {
    discovered: number;
    revised: number;
    unchanged: number;
    editorialNew: number;
    retained: number;
    sourceFailures: number;
  };
};

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function canonicalPublicUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || ['ref', 'fbclid', 'gclid'].includes(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    u.searchParams.sort();
    return u.toString();
  } catch {
    return null;
  }
}

function normalized(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function validDate(value: string | undefined, now: number): string | null {
  if (!value) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) && date <= now + 12 * 60 * 60_000 && date >= Date.UTC(2000, 0, 1)
    ? new Date(date).toISOString() : null;
}

function editorial(item: FrontierItem): boolean {
  return item.sourceKind !== 'sports_state' && !item.sportsState;
}

export function frontierDiscoveryIdentity(item: FrontierItem): string | null {
  const url = canonicalPublicUrl(item.url);
  return url ? sha(url) : null;
}

function isLedger(value: unknown): value is FrontierDiscoveryLedger {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrontierDiscoveryLedger>;
  return candidate.version === 1 && typeof candidate.entries === 'object'
    && !!candidate.entries && !Array.isArray(candidate.entries)
    && typeof candidate.sources === 'object' && !!candidate.sources
    && !Array.isArray(candidate.sources);
}

/**
 * Durable, privacy-neutral discovery observation. Updated nightly in Git
 * alongside the existing archive, so process restarts and deployments do not
 * erase first-seen history. No browser profiles, searches, article bodies,
 * credentials or source content are stored, only URL/content digests.
 *
 * This reports observations at snapshot cadence. An upstream "ok" only means
 * the adapter said it succeeded; it is not evidence of complete source coverage.
 */
export function buildFrontierDiscoveryLedger(
  feed: FrontierFeedResponse,
  previous: unknown = null,
): FrontierDiscoveryLedger {
  const at = validDate(feed.generatedAt, Date.now());
  if (!at) throw new Error('FRONTIER archive has invalid generation timestamp');
  const now = Date.parse(at);
  const old = isLedger(previous) ? previous : null;
  const entries: Record<string, FrontierDiscoveryLedgerEntry> = Object.create(null);
  const cutoff = now - RETENTION_DAYS * DAY_MS;
  for (const [key, item] of Object.entries(old?.entries ?? {}).slice(0, MAX_ENTRIES)) {
    if (!/^[a-f0-9]{32}$/.test(key) || !item || typeof item !== 'object') continue;
    const last = validDate(item.lastSeenAt, now);
    if (!last || Date.parse(last) < cutoff || typeof item.contentDigest !== 'string') continue;
    entries[key] = { ...item, lastSeenAt: last };
  }
  const sources: Record<string, FrontierDiscoverySourceCheckpoint> = Object.create(null);
  for (const [kind, state] of Object.entries(old?.sources ?? {}).slice(0, MAX_SOURCES)) {
    if (!/^[a-z0-9_]{1,40}$/.test(kind) || !state || typeof state !== 'object') continue;
    sources[kind] = { ...state, newlyObserved: 0, revised: 0, editorialNew: 0 };
  }

  let discovered = 0;
  let revised = 0;
  let unchanged = 0;
  let editorialNew = 0;
  const unique = new Set<string>();
  for (const item of (feed.items ?? []).slice(0, 500)) {
    const key = frontierDiscoveryIdentity(item);
    const publishedAt = validDate(item.publishedAt, now);
    if (!key || !publishedAt || unique.has(key)) continue;
    unique.add(key);
    const kind = item.sourceKind;
    const digest = sha([normalized(item.title), normalized(item.summary)].join('\n'));
    const oldItem = entries[key];
    const isEditorial = editorial(item);
    if (!oldItem) {
      discovered += 1;
      if (isEditorial) editorialNew += 1;
    } else if (oldItem.contentDigest !== digest) {
      revised += 1;
    } else {
      unchanged += 1;
    }
    entries[key] = {
      sourceKind: kind,
      firstSeenAt: oldItem?.firstSeenAt ?? at,
      lastSeenAt: at,
      firstPublishedAt: oldItem?.firstPublishedAt ?? publishedAt,
      lastPublishedAt: publishedAt,
      lastContentChangedAt: oldItem && oldItem.contentDigest === digest
        ? oldItem.lastContentChangedAt : at,
      contentDigest: digest,
      editorial: isEditorial,
    };
    // A source can publish content even when no source status was emitted.
    // Record novelty, but never claim a source fetch succeeded in that case.
    if (!sources[kind]) {
      sources[kind] = {
        lastAttemptAt: at,
        consecutiveFailures: 0,
        lastReportedCount: 0,
        newlyObserved: 0,
        revised: 0,
        editorialNew: 0,
      };
    }
    if (!oldItem) {
      sources[kind].newlyObserved += 1;
      if (isEditorial) sources[kind].editorialNew += 1;
    } else if (oldItem.contentDigest !== digest) sources[kind].revised += 1;
  }

  let sourceFailures = 0;
  for (const source of (feed.sources ?? []).slice(0, MAX_SOURCES)) {
    const id = source.id;
    if (!/^[a-z0-9_]{1,40}$/.test(id)) continue;
    const prior = sources[id];
    if (!source.ok) sourceFailures++;
    sources[id] = {
      lastAttemptAt: at,
      lastSuccessAt: source.ok ? at : prior?.lastSuccessAt,
      consecutiveFailures: source.ok ? 0 : Math.min(365, (prior?.consecutiveFailures ?? 0) + 1),
      lastReportedCount: Math.max(0, Math.min(100_000, Math.floor(source.count || 0))),
      newlyObserved: prior?.newlyObserved ?? 0,
      revised: prior?.revised ?? 0,
      editorialNew: prior?.editorialNew ?? 0,
    };
  }

  // Cap after updating today's observations. Older/least-recent observations
  // are evicted first; losing history must never change whether an item renders.
  const retained = Object.entries(entries)
    .sort((a, b) => b[1].lastSeenAt.localeCompare(a[1].lastSeenAt) || a[0].localeCompare(b[0]))
    .slice(0, MAX_ENTRIES);
  return {
    version: 1,
    generatedAt: at,
    entries: Object.fromEntries(retained),
    sources: Object.fromEntries(Object.entries(sources).slice(0, MAX_SOURCES)),
    latest: { discovered, revised, unchanged, editorialNew, retained: retained.length, sourceFailures },
  };
}

export function assertQualifiedFrontierArchive(feed: FrontierFeedResponse, now = Date.now()): void {
  if (!frontierHasUsableRecentFeed(feed, now)) {
    throw new Error('Refusing to publish FRONTIER archive: insufficient fresh editorial candidates from distinct source kinds');
  }
}
