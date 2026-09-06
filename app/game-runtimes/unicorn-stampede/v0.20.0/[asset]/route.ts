import { NextResponse } from 'next/server';

const UNICORN_STAMPEDE_VERSION = 'v0.20.0';
const UNICORN_STAMPEDE_SOURCE_COMMIT = '33a0ec77bc5abb9a3644bf1eca367d26cd439ec8';
const UNICORN_STAMPEDE_SOURCE_ARTIFACT = 'dist/local.html';
const SOURCE_URL = `https://raw.githubusercontent.com/sidhulyalkar/unicorn-stampede/${UNICORN_STAMPEDE_SOURCE_COMMIT}/${UNICORN_STAMPEDE_SOURCE_ARTIFACT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

type UnicornStampedeRuntimeRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

function prepareForGameNetwork(html: string) {
  const withTabIndex = html.includes('<canvas id=c tabindex=0')
    ? html
    : html.replace('<canvas id=c ', '<canvas id=c tabindex=0 ');
  if (!withTabIndex.includes('<canvas id=c tabindex=0')) {
    throw new Error('Pinned Unicorn Stampede artifact no longer exposes the expected canvas shell.');
  }
  if (withTabIndex.includes('/game-runtimes/game-network-bridge.js')) return withTabIndex;
  return withTabIndex.includes('</body>')
    ? withTabIndex.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`)
    : `${withTabIndex}\n${GAME_NETWORK_BRIDGE}\n`;
}

export async function GET(_request: Request, { params }: UnicornStampedeRuntimeRouteProps) {
  const { asset } = await params;
  if (asset !== 'index.html') {
    return new NextResponse('Unknown Unicorn Stampede runtime asset.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const upstream = await fetch(SOURCE_URL, {
    headers: { Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8' },
    cache: 'force-cache',
  });

  if (!upstream.ok) {
    return new NextResponse('Pinned Unicorn Stampede runtime artifact is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const html = await upstream.text();
  if (!html.includes('<title>Unicorn Stampede</title>')) {
    return new NextResponse('Pinned Unicorn Stampede runtime artifact failed its release identity check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!html.includes('<canvas id=c width=1280 height=720>')) {
    return new NextResponse('Pinned Unicorn Stampede runtime artifact failed its canvas contract check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let body: string;
  try {
    body = prepareForGameNetwork(html);
  } catch {
    return new NextResponse('Pinned Unicorn Stampede runtime artifact failed its host integration check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Unicorn-Stampede-Version': UNICORN_STAMPEDE_VERSION,
      'X-Unicorn-Stampede-Source-Commit': UNICORN_STAMPEDE_SOURCE_COMMIT,
      'X-Unicorn-Stampede-Source-Artifact': UNICORN_STAMPEDE_SOURCE_ARTIFACT,
    },
  });
}
