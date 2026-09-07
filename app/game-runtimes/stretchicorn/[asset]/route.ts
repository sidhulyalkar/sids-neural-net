import { NextResponse } from 'next/server';

/** Live-tracking tip of stretchicorn main (qualified local-playable build). */
const STRETCHICORN_SOURCE_REF = 'main';
const STRETCHICORN_SOURCE_ARTIFACT = 'dist/stretchicorn-local.html';
const SOURCE_URL = `https://raw.githubusercontent.com/sidhulyalkar/stretchicorn/${STRETCHICORN_SOURCE_REF}/${STRETCHICORN_SOURCE_ARTIFACT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

type StretchicornRuntimeRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

function prepareForGameNetwork(html: string) {
  const focusable = html.includes('<canvas id=c tabindex=0')
    ? html
    : html.replace('<canvas id=c ', '<canvas id=c tabindex=0 ');
  if (!focusable.includes('<canvas id=c tabindex=0')) {
    throw new Error('Stretchicorn artifact no longer exposes the expected canvas shell.');
  }
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
    next: { revalidate: 300 },
  });

  if (!upstream.ok) {
    return new NextResponse('Stretchicorn runtime artifact is unavailable from GitHub main.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const html = await upstream.text();
  if (!/<title>[^<]*Stretchicorn/i.test(html)) {
    return new NextResponse('Stretchicorn runtime artifact failed its identity check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let body: string;
  try {
    body = prepareForGameNetwork(html);
  } catch {
    return new NextResponse('Stretchicorn runtime artifact failed its host integration check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Stretchicorn-Source-Ref': STRETCHICORN_SOURCE_REF,
      'X-Stretchicorn-Source-Artifact': STRETCHICORN_SOURCE_ARTIFACT,
    },
  });
}
