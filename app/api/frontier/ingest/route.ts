import { NextRequest, NextResponse } from 'next/server';
import { FrontierSourceIngestor, type FrontierIngestSourceId } from '@/lib/frontier/sourceIngestor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SOURCES = new Set<FrontierIngestSourceId>([
  'arxiv',
  'huggingface',
  'github',
  'paperswithcode',
  'hackernews',
  'rss',
]);

export async function GET(request: NextRequest) {
  const rawSource = (request.nextUrl.searchParams.get('source') || 'all').toLowerCase();
  const query = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 160);
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || '12');
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(24, Math.round(requestedLimit))) : 12;
  const ingestor = new FrontierSourceIngestor();

  const sources = rawSource === 'all'
    ? Array.from(ALLOWED_SOURCES)
    : ALLOWED_SOURCES.has(rawSource as FrontierIngestSourceId)
      ? [rawSource as FrontierIngestSourceId]
      : [];

  if (!sources.length) {
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), items: [], sources: [], error: 'unsupported FRONTIER source' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const feed = await ingestor.ingestMany(sources, { query, limit });
  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': query
        ? 'private, max-age=30, stale-while-revalidate=90'
        : 'public, s-maxage=180, stale-while-revalidate=600',
      'X-Frontier-Ingest': sources.join(','),
    },
  });
}
