/**
 * Only common, anonymous upstream discovery may enter the shared fetch cache.
 * No browser interest history, arbitrary focus phrases or bearer credentials
 * can become cache keys or cached values.
 */
export type FrontierPublicUpstream = 'arxiv' | 'huggingface' | 'github' | 'paperswithcode' | 'hackernews' | 'rss';

const PUBLIC_TTL_SECONDS: Record<FrontierPublicUpstream, number> = {
  arxiv: 900,
  huggingface: 600,
  github: 900,
  paperswithcode: 1800,
  hackernews: 300,
  rss: 900,
};

export function frontierUpstreamTtlSeconds(
  source: FrontierPublicUpstream,
  query: string,
  hasCredentials = false,
): number {
  return query.trim() || hasCredentials ? 0 : PUBLIC_TTL_SECONDS[source];
}

/** A stable moving window prevents every incoming HN request from missing the cache. */
export function frontierHackerNewsSince(nowMs: number, windowDays = 3): number {
  const oldestMs = nowMs - windowDays * 86_400_000;
  return Math.floor(oldestMs / 300_000) * 300;
}
