import { NextResponse } from 'next/server';

const UNIRICO_COMMIT = '5c3737957f302e9c44917097494684419e58e757';
const SOURCE_ROOT = `https://raw.githubusercontent.com/sidhulyalkar/uniRico/${UNIRICO_COMMIT}/src`;

const ALLOWED_ASSETS = new Set([
  'index.html',
  'style.css',
  'levels.js',
  'runtime/core.js',
  'runtime/audio.js',
  'runtime/physics.js',
  'runtime/render-world.js',
  'runtime/render-entities.js',
  'runtime/render-hud.js',
  'runtime/ui.js',
]);

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
};

type RuntimeAssetRouteProps = {
  params: Promise<{ asset: string[] }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  const path = asset.join('/');
  if (!ALLOWED_ASSETS.has(path)) {
    return new NextResponse('Unknown arcade runtime asset.', { status: 404 });
  }

  const upstream = await fetch(`${SOURCE_ROOT}/${path}`, {
    headers: { Accept: 'text/plain,*/*;q=0.8' },
    cache: 'force-cache',
  });

  if (!upstream.ok) {
    return new NextResponse('Pinned uniRico runtime asset is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = path.split('.').pop() ?? 'txt';
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
