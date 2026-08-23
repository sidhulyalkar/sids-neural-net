import { NextResponse } from 'next/server';

const STRETCHICORN_COMMIT = '5635de71cae80a7728a45b11fd660fd87112c351';
const SOURCE_ROOT = `https://raw.githubusercontent.com/sidhulyalkar/stretchicorn/${STRETCHICORN_COMMIT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

const ALLOWED_ASSETS = new Set([
  'index.html',
  'src/style.css',
  'src/00-core.js',
  'src/01-combat.js',
  'src/02-update.js',
  'src/03-render.js',
  'src/04-ui-input.js',
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

function prepareStretchicornHtml(html: string) {
  let prepared = html;

  prepared = prepared.replace(
    '<canvas id="c" width="960" height="640"></canvas>',
    '<canvas id="c" width="960" height="640" tabindex="0" aria-label="Stretchicorn arcade game"></canvas>'
  );

  if (!prepared.includes('/game-runtimes/game-network-bridge.js')) {
    const firstGameScript = '<script src="src/00-core.js"></script>';
    prepared = prepared.includes(firstGameScript)
      ? prepared.replace(firstGameScript, `${GAME_NETWORK_BRIDGE}\n${firstGameScript}`)
      : `${prepared}\n${GAME_NETWORK_BRIDGE}\n`;
  }

  return prepared;
}

export async function GET(_request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  const path = asset.join('/');

  if (!ALLOWED_ASSETS.has(path)) {
    return new NextResponse('Unknown Stretchicorn runtime asset.', { status: 404 });
  }

  const upstream = await fetch(`${SOURCE_ROOT}/${path}`, {
    headers: { Accept: 'text/plain,*/*;q=0.8' },
    cache: 'force-cache',
  });

  if (!upstream.ok) {
    return new NextResponse('Pinned Stretchicorn runtime asset is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = path.split('.').pop() ?? 'txt';
  const body = path === 'index.html'
    ? prepareStretchicornHtml(await upstream.text())
    : await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Stretchicorn-Upstream': `sidhulyalkar/stretchicorn@${STRETCHICORN_COMMIT}`,
    },
  });
}
