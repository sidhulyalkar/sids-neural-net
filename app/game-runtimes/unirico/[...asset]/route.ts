import { NextResponse } from 'next/server';

const UNIRICO_VERSION = 'v0.19.0';
const UNIRICO_SOURCE_COMMIT = '13de2151bb2731557392e3399354ee7e744415f3';
const SOURCE_ROOT = `https://raw.githubusercontent.com/sidhulyalkar/uniRico/${UNIRICO_SOURCE_COMMIT}/src`;
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

function redirectLegacyAsset(request: Request, path: string) {
  const target = new URL(`/game-runtimes/unirico/${UNIRICO_VERSION}/${path}`, request.url);
  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}

export async function GET(request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  const requestedVersion = asset.length > 1 && /^v\d/.test(asset[0]) ? asset[0] : null;
  const path = (requestedVersion ? asset.slice(1) : asset).join('/');

  if (!ALLOWED_ASSETS.has(path)) {
    return new NextResponse('Unknown arcade runtime asset.', { status: 404 });
  }

  if (!requestedVersion) return redirectLegacyAsset(request, path);
  if (requestedVersion !== UNIRICO_VERSION) {
    return new NextResponse('Unknown uniRico runtime version.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
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
  const body = path === 'index.html'
    ? injectGameNetworkBridge(await upstream.text())
    : await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-UniRico-Version': UNIRICO_VERSION,
      'X-UniRico-Source-Commit': UNIRICO_SOURCE_COMMIT,
    },
  });
}
