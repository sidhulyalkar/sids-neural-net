import { NextRequest, NextResponse } from 'next/server';
import { getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const focusTopics = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  try {
    const feed = await getIntegratedFrontierFeed({ focusTopics });
    return NextResponse.json(feed, {
      headers: {
        // The route executes independently of deployments. The shared feed gets
        // a short edge cache; personalized focus queries remain browser-private
        // while their upstream adapters use bounded request-time fetching.
        'Cache-Control': focusTopics.length
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
