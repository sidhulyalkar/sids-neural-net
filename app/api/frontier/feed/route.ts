import { NextRequest, NextResponse } from 'next/server';
import { getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_TEAMS } from '@/lib/frontier/interests';
import { FRONTIER_DISCOVERY_SEEDS } from '@/lib/frontier/personalTaste';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function defaultPersonalFocus(): string[] {
  // Cold-start requests should spend their scarce adaptive-search budget on the
  // owner's strongest explicit interests, not generic technology news. Keep the
  // first six slots research/analysis-heavy, then preserve all four favorite
  // teams. Once the client has a behavior profile it sends its own adaptive
  // focus and this fallback disappears from authority.
  return Array.from(new Set([
    ...FRONTIER_DISCOVERY_SEEDS.slice(0, 6),
    ...FRONTIER_TEAMS.map((team) => team.label),
  ])).slice(0, 10);
}

export async function GET(request: NextRequest) {
  const requestedFocus = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  // FRONTIER is a personal surface. An omitted focus must never silently become
  // a generic-news authority path, because the client may use this endpoint as
  // a sparse-feed fallback. Default to the explicit owner taste map instead.
  const focusTopics = requestedFocus.length ? requestedFocus : defaultPersonalFocus();
  const forceFresh = request.nextUrl.searchParams.get('fresh') === '1';
  try {
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
