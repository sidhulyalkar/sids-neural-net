import { NextRequest, NextResponse } from 'next/server';
import { getFrontierSnapshotFeed, getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_TEAMS } from '@/lib/frontier/interests';
import { FRONTIER_DISCOVERY_SEEDS } from '@/lib/frontier/personalTaste';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';

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
    const feed = decorateFeedMedia(await getIntegratedFrontierFeed({
      focusTopics,
      includeSnapshot: false,
      adapterDeadlineMs: forceFresh ? MANUAL_REFRESH_BUDGET_MS : FOCUSED_LIVE_BUDGET_MS,
    }));
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
