import { NextRequest, NextResponse } from 'next/server';
import { getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const focusTopics = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  const forceFresh = request.nextUrl.searchParams.get('fresh') === '1';
  try {
    const feed = decorateFeedMedia(await getIntegratedFrontierFeed({ focusTopics }));
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': forceFresh
          ? 'no-store'
          : focusTopics.length
            ? 'private, max-age=60, stale-while-revalidate=120'
            : 'public, s-maxage=180, stale-while-revalidate=600',
        'X-Frontier-Live': focusTopics.length ? 'adaptive' : 'shared',
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
