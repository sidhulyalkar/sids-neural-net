import { NextRequest, NextResponse } from 'next/server';
import { getFrontierSnapshotFeed, getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_TEAMS } from '@/lib/frontier/interests';
import { FRONTIER_DISCOVERY_SEEDS } from '@/lib/frontier/personalTaste';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';
import { getCdnSportsStateFeed } from '@/lib/frontier/sportsStateCdnRequest';
import type { FrontierFeedResponse } from '@/lib/frontier/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOCUSED_LIVE_BUDGET_MS = 4_000;
const MANUAL_REFRESH_BUDGET_MS = 5_500;

function defaultPersonalFocus(): string[] {
  // A manual live rotation should spend its bounded Internet-search budget on
  // the strongest explicit interests rather than generic technology news.
  return Array.from(new Set([
    ...FRONTIER_DISCOVERY_SEEDS.slice(0, 6),
    ...FRONTIER_TEAMS.map((team) => team.label),
  ])).slice(0, 10);
}

function mergeRequestSportsState(
  feed: FrontierFeedResponse,
  sports: FrontierFeedResponse,
): FrontierFeedResponse {
  const byId = new Map(feed.items.map((item) => [item.id, item]));
  // Structured sports utility is authoritative over a same-id stale result,
  // while every unrelated recommendation keeps its integrated ranking payload.
  for (const item of sports.items) byId.set(item.id, item);
  const items = Array.from(byId.values());
  const sportsItems = items.filter((item) => item.sourceKind === 'sports_state');
  const previousSports = feed.sources.find((source) => source.id === 'sports_state');
  const cdnSports = sports.sources.find((source) => source.id === 'sports_state');
  const sources = feed.sources.filter((source) => source.id !== 'sports_state');

  sources.unshift({
    id: 'sports_state',
    label: cdnSports?.ok ? 'Live sports state · ESPN CDN' : (previousSports?.label ?? 'Live sports state'),
    ok: sportsItems.length > 0,
    count: sportsItems.length,
    message: sportsItems.length
      ? cdnSports?.message
      : (cdnSports?.message ?? previousSports?.message ?? 'live sports state temporarily unavailable'),
  });

  return { ...feed, items, sources };
}

export async function GET(request: NextRequest) {
  const requestedFocus = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  const forceFresh = request.nextUrl.searchParams.get('fresh') === '1';

  try {
    // Cold navigation is snapshot-first so useful cards paint immediately. A
    // refresh or focused query is a different product contract: it must search
    // live adapters and must not silently refill the result set from yesterday's
    // committed archive. The browser recommendation engine ranks those fresh
    // candidates after the server has enforced provenance and source policy.
    if (!requestedFocus.length && !forceFresh) {
      return NextResponse.json(decorateFeedMedia(getFrontierSnapshotFeed()), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          'X-Frontier-Live': 'personal-snapshot',
        },
      });
    }

    const focusTopics = requestedFocus.length ? requestedFocus : defaultPersonalFocus();
    // The integrated mesh still owns recommendation discovery. Sports state is
    // fetched in parallel from the independently proven CDN transport, so the
    // failing Site API path cannot erase Patriots/Warriors/Chelsea/City utility
    // from a manual refresh and cannot lengthen the existing discovery budget.
    const [integratedFeed, requestSports] = await Promise.all([
      getIntegratedFrontierFeed({
        focusTopics,
        includeSnapshot: false,
        adapterDeadlineMs: forceFresh ? MANUAL_REFRESH_BUDGET_MS : FOCUSED_LIVE_BUDGET_MS,
      }),
      getCdnSportsStateFeed(),
    ]);
    const feed = decorateFeedMedia(mergeRequestSportsState(integratedFeed, requestSports));
    const mode = forceFresh ? 'fresh-live' : 'focused-live';
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Frontier-Live': mode,
        'X-Frontier-Result-Count': String(feed.items.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        items: [],
        sources: [],
        error: error instanceof Error ? error.message : 'FRONTIER feed unavailable',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Frontier-Live': 'degraded' } }
    );
  }
}
