import { NextRequest, NextResponse } from 'next/server';
import { getFrontierSnapshotFeed, getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_TEAMS } from '@/lib/frontier/interests';
import { FRONTIER_DISCOVERY_SEEDS } from '@/lib/frontier/personalTaste';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function defaultPersonalFocus(): string[] {
  // Fresh cold-start discovery should spend its scarce adaptive-search budget on
  // the owner's strongest explicit interests, not generic technology news.
  return Array.from(new Set([
    ...FRONTIER_DISCOVERY_SEEDS.slice(0, 6),
    ...FRONTIER_TEAMS.map((team) => team.label),
  ])).slice(0, 10);
}

export async function GET(request: NextRequest) {
  const requestedFocus = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  const forceFresh = request.nextUrl.searchParams.get('fresh') === '1';

  try {
    // The client intentionally asks without focus when a focused response is too
    // sparse. That fallback must be instant and genuinely broader, not a second
    // copy of the same live fan-out. Serve the already-vetted personalized
    // snapshot unless the caller explicitly requests a fresh live rotation.
    if (!requestedFocus.length && !forceFresh) {
      return NextResponse.json(decorateFeedMedia(getFrontierSnapshotFeed()), {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          'X-Frontier-Live': 'personal-snapshot',
        },
      });
    }

    const focusTopics = requestedFocus.length ? requestedFocus : defaultPersonalFocus();
    const feed = decorateFeedMedia(await getIntegratedFrontierFeed({ focusTopics }));
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': forceFresh
          ? 'no-store'
          : 'private, max-age=60, stale-while-revalidate=120',
        'X-Frontier-Live': requestedFocus.length ? 'adaptive' : 'personal-default',
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
