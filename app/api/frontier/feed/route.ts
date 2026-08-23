import { NextRequest, NextResponse } from 'next/server';
import { getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';
import { decodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import { decorateFeedMedia } from '@/lib/frontier/media/proxySecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_FOCUS_IDS = [
  'patriots',
  'warriors',
  'chelsea',
  'man-city',
  'active-sports',
  'bass',
  'games',
  'neuroai',
  'open-source',
  'ml-data',
] as const;

function defaultPersonalFocus(): string[] {
  const byId = new Map(FRONTIER_PINNED_TOPICS.map((topic) => [topic.id, topic.label]));
  return DEFAULT_FOCUS_IDS.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
}

export async function GET(request: NextRequest) {
  const requestedFocus = decodeDiscoveryFocus(request.nextUrl.searchParams.get('focus'));
  // FRONTIER is a personal surface. An omitted focus must never silently become
  // a generic-news authority path, because the client may use this endpoint as
  // a sparse-feed fallback. Default to a balanced owner-interest seed instead.
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
