import { NextRequest, NextResponse } from 'next/server';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';
import type { FrontierObservableFeedResponse } from '@/lib/frontier/pipelineDiagnostics';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';
import type { FrontierFeedResponse } from '@/lib/frontier/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOCUSED_LIVE_BUDGET_MS = 4_000;
const MANUAL_REFRESH_BUDGET_MS = 5_500;

type LiveDependencies = {
  getIntegratedFrontierFeed: typeof import('@/lib/frontier/aggregate').getIntegratedFrontierFeed;
  getCdnSportsStateFeed: typeof import('@/lib/frontier/sportsStateCdnRequest').getCdnSportsStateFeed;
  teams: typeof import('@/lib/frontier/interests').FRONTIER_TEAMS;
  discoverySeeds: typeof import('@/lib/frontier/personalTaste').FRONTIER_DISCOVERY_SEEDS;
};

/**
 * None of the live discovery graph belongs on passive navigation's module path.
 * Load it only when the user explicitly asks for focused or fresh Internet
 * discovery. This turns "snapshot first" into an actual cold-start invariant
 * instead of merely branching after the expensive modules have initialized.
 */
async function loadLiveDependencies(): Promise<LiveDependencies> {
  const [aggregate, sports, interests, taste] = await Promise.all([
    import('@/lib/frontier/aggregate'),
    import('@/lib/frontier/sportsStateCdnRequest'),
    import('@/lib/frontier/interests'),
    import('@/lib/frontier/personalTaste'),
  ]);
  return {
    getIntegratedFrontierFeed: aggregate.getIntegratedFrontierFeed,
    getCdnSportsStateFeed: sports.getCdnSportsStateFeed,
    teams: interests.FRONTIER_TEAMS,
    discoverySeeds: taste.FRONTIER_DISCOVERY_SEEDS,
  };
}

function defaultPersonalFocus(dependencies: LiveDependencies): string[] {
  // A manual live rotation should spend its bounded Internet-search budget on
  // the strongest explicit interests rather than generic technology news.
  return Array.from(new Set([
    ...dependencies.discoverySeeds.slice(0, 6),
    ...dependencies.teams.map((team) => team.label),
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
    // Cold navigation is snapshot-first so useful cards paint immediately. The
    // snapshot module is intentionally independent of every live adapter. A
    // refresh or focused query has a separate contract and lazy-loads the full
    // Internet discovery graph only after the request has opted into it.
    if (!requestedFocus.length && !forceFresh) {
      return NextResponse.json(decorateFeedMedia(getFrontierColdSnapshotFeed()), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          'X-Frontier-Live': 'personal-snapshot',
        },
      });
    }

    const dependencies = await loadLiveDependencies();
    const focusTopics = requestedFocus.length ? requestedFocus : defaultPersonalFocus(dependencies);
    const mode = forceFresh ? 'fresh-live' : 'focused-live';
    // The integrated mesh still owns recommendation discovery. Sports state is
    // fetched in parallel from the independently proven CDN transport, so the
    // failing Site API path cannot erase team utility from a manual refresh and
    // cannot lengthen the existing discovery budget.
    const [integratedFeed, requestSports] = await Promise.all([
      dependencies.getIntegratedFrontierFeed({
        focusTopics,
        includeSnapshot: false,
        pipelineMode: mode,
        adapterDeadlineMs: forceFresh ? MANUAL_REFRESH_BUDGET_MS : FOCUSED_LIVE_BUDGET_MS,
      }),
      dependencies.getCdnSportsStateFeed(),
    ]);
    const decorated = decorateFeedMedia(mergeRequestSportsState(integratedFeed, requestSports));
    // Media/sports decorators intentionally operate on the historical base feed
    // shape. Reattach the optional diagnostic extension explicitly so a future
    // narrow return type can never erase observability by accident.
    const feed: FrontierObservableFeedResponse = {
      ...decorated,
      ...(integratedFeed.pipeline ? { pipeline: integratedFeed.pipeline } : {}),
    };
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
