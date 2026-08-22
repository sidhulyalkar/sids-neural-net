import { NextRequest, NextResponse } from 'next/server';
import { fetchBoundedPublicForageText, type FrontierForageFetchMode } from '@/lib/frontier/forage/webGateway';
import { parseRss } from '@/lib/frontier/sourceIngestor';
import type { FrontierFeedResponse } from '@/lib/frontier/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawUrl = (request.nextUrl.searchParams.get('url') || '').trim();
  const rawMode = (request.nextUrl.searchParams.get('mode') || 'html').toLowerCase();
  const mode: FrontierForageFetchMode | undefined = rawMode === 'html' || rawMode === 'feed' ? rawMode : undefined;
  if (!rawUrl || rawUrl.length > 2_048 || !mode) {
    return NextResponse.json(
      { error: 'invalid FRONTIER forage request' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const fetched = await fetchBoundedPublicForageText(rawUrl, mode, request.signal);
    if (mode === 'html') {
      return NextResponse.json({
        url: fetched.finalUrl,
        contentType: fetched.contentType,
        html: fetched.text,
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Frontier-Forage': 'html',
        },
      });
    }

    const items = parseRss(fetched.text, fetched.finalUrl).slice(0, 24);
    const host = new URL(fetched.finalUrl).hostname.replace(/^www\./, '');
    const feed: FrontierFeedResponse = {
      generatedAt: new Date().toISOString(),
      items,
      sources: [{
        id: 'rss',
        label: `Autonomous · ${host}`,
        ok: true,
        count: items.length,
      }],
    };
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Frontier-Forage': 'feed',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        items: [],
        sources: [],
        error: error instanceof Error ? error.message.slice(0, 200) : 'FRONTIER forage gateway unavailable',
      },
      { status: 422, headers: { 'Cache-Control': 'no-store', 'X-Frontier-Forage': 'rejected' } }
    );
  }
}
