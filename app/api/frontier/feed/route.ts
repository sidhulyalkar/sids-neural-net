import { NextResponse } from 'next/server';
import { getIntegratedFrontierFeed } from '@/lib/frontier/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feed = await getIntegratedFrontierFeed();
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
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
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
