import { getPublishedStory, readPublishedStoryAsset } from '@/lib/frontier/evidence/publishedStory';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; digest: string }> };

/** Read-only, hash-verified publisher-approved assets.
 * No raw URL parameter, no origin fetch and no directory traversal. */
export async function GET(_request: Request, { params }: Params) {
  const { id, digest } = await params;
  if (!/^[a-z0-9][a-z0-9_-]{2,119}$/.test(id) || !/^[a-f0-9]{64}$/.test(digest)) {
    return new Response(null, { status: 404 });
  }
  try {
    const story = await getPublishedStory(id);
    if (!story) return new Response(null, { status: 404 });
    const asset = await readPublishedStoryAsset(story, digest);
    if (!asset) return new Response(null, { status: 404 });
    const bytes = new Uint8Array(asset.bytes);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('FRONTIER approved story asset unavailable:', error instanceof Error ? error.name : 'unknown');
    return new Response(null, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
