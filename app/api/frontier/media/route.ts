import { NextRequest, NextResponse } from 'next/server';
import { assertSafeMediaUrl } from '@/lib/frontier/media/proxySecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 7_000;

async function fetchSafeImage(url: URL, redirects = 0): Promise<{ bytes: ArrayBuffer; contentType: string; source: URL }> {
  if (redirects > MAX_REDIRECTS) throw new Error('Too many media redirects');
  const safeUrl = await assertSafeMediaUrl(url.toString());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(safeUrl, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.1' },
      cache: 'no-store',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Media redirect missing location');
      return fetchSafeImage(new URL(location, safeUrl), redirects + 1);
    }
    if (!response.ok) throw new Error(`Upstream media ${response.status}`);

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Proxy accepts images only');
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_MEDIA_BYTES) throw new Error('Image exceeds FRONTIER media limit');
    if (!response.body) throw new Error('Media response has no body');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await reader.cancel();
        throw new Error('Image exceeds FRONTIER media limit');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(new ArrayBuffer(total));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes: bytes.buffer, contentType, source: safeUrl };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'missing media url' }, { status: 400 });
  try {
    const result = await fetchSafeImage(new URL(raw));
    return new NextResponse(result.bytes, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frontier-Media-Source': result.source.hostname,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'media unavailable' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
