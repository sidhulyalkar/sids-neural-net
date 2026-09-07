import { NextResponse } from 'next/server';

/** Live-tracking tip of uniRico main (readable multi-file src/ build). */
const UNIRICO_SOURCE_REF = 'main';
const SOURCE_ROOT = `https://raw.githubusercontent.com/sidhulyalkar/uniRico/${UNIRICO_SOURCE_REF}/src`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

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

function injectGameNetworkBridge(html: string) {
  if (html.includes('/game-runtimes/game-network-bridge.js')) return html;
  return html.includes('</body>')
    ? html.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`)
    : `${html}\n${GAME_NETWORK_BRIDGE}\n`;
}

function redirectToCanonical(request: Request, path: string) {
  const target = new URL(`/game-runtimes/unirico/${path}`, request.url);
  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}

export async function GET(request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  // Accept legacy /game-runtimes/unirico/vX.Y.Z/... and rewrite to unversioned paths.
  const requestedVersion = asset.length > 1 && /^v\d/.test(asset[0]) ? asset[0] : null;
  const path = (requestedVersion ? asset.slice(1) : asset).join('/');

  if (!ALLOWED_ASSETS.has(path)) {
    return new NextResponse('Unknown arcade runtime asset.', { status: 404 });
  }

  // Versioned bookmarks → canonical unversioned live-main URLs.
  if (requestedVersion) return redirectToCanonical(request, path);

  const upstream = await fetch(`${SOURCE_ROOT}/${path}`, {
    headers: { Accept: 'text/plain,*/*;q=0.8' },
    next: { revalidate: 300 },
  });

  if (!upstream.ok) {
    return new NextResponse('uniRico runtime asset is unavailable from GitHub main.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = path.split('.').pop() ?? 'txt';
  let body: BodyInit;
  if (path === 'index.html') {
    const html = await upstream.text();
    if (!/<title>[^<]*uniRico/i.test(html)) {
      return new NextResponse('uniRico runtime artifact failed its identity check.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    body = injectGameNetworkBridge(html);
  } else {
    body = await upstream.arrayBuffer();
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-UniRico-Source-Ref': UNIRICO_SOURCE_REF,
    },
  });
}
