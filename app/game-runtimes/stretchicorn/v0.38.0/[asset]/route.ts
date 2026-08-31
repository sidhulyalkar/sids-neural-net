import { NextResponse } from 'next/server';

const STRETCHICORN_VERSION = 'v0.38.0';
const STRETCHICORN_SOURCE_COMMIT = '07d38322d5b9927a9b9eca6fec38546925801c16';
const STRETCHICORN_SOURCE_ARTIFACT = 'dist/stretchicorn-local.html';
const SOURCE_URL = `https://raw.githubusercontent.com/sidhulyalkar/stretchicorn/${STRETCHICORN_SOURCE_COMMIT}/${STRETCHICORN_SOURCE_ARTIFACT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

type StretchicornRuntimeRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

function prepareForGameNetwork(html: string) {
  const focusable = html.includes('<canvas id=c tabindex=0')
    ? html
    : html.replace('<canvas id=c ', '<canvas id=c tabindex=0 ');
  if (focusable.includes('/game-runtimes/game-network-bridge.js')) return focusable;
  return focusable.includes('</body>')
    ? focusable.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`)
    : `${focusable}\n${GAME_NETWORK_BRIDGE}\n`;
}

export async function GET(_request: Request, { params }: StretchicornRuntimeRouteProps) {
  const { asset } = await params;
  if (asset !== 'index.html') {
    return new NextResponse('Unknown Stretchicorn runtime asset.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const upstream = await fetch(SOURCE_URL, {
    headers: { Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8' },
    cache: 'force-cache',
  });

  if (!upstream.ok) {
    return new NextResponse('Pinned Stretchicorn runtime artifact is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const html = await upstream.text();
  if (!html.includes('<title>Stretchicorn v0.38.0 local playtest</title>')) {
    return new NextResponse('Pinned Stretchicorn runtime artifact failed its release identity check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new NextResponse(prepareForGameNetwork(html), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Stretchicorn-Version': STRETCHICORN_VERSION,
      'X-Stretchicorn-Source-Commit': STRETCHICORN_SOURCE_COMMIT,
      'X-Stretchicorn-Source-Artifact': STRETCHICORN_SOURCE_ARTIFACT,
    },
  });
}
