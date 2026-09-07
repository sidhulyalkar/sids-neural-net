import { NextResponse } from 'next/server';

/** Live-tracking tip of unicorn-stampede main (qualified human-playable build). */
const UNICORN_STAMPEDE_SOURCE_REF = 'main';
const UNICORN_STAMPEDE_SOURCE_ARTIFACT = 'dist/local.html';
const SOURCE_URL = `https://raw.githubusercontent.com/sidhulyalkar/unicorn-stampede/${UNICORN_STAMPEDE_SOURCE_REF}/${UNICORN_STAMPEDE_SOURCE_ARTIFACT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

type UnicornStampedeRuntimeRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

function prepareForGameNetwork(html: string) {
  // Ensure the canvas can receive keyboard focus inside the Game Network shell.
  let focusable = html;
  if (html.includes('<canvas id=c ') && !html.includes('<canvas id=c tabindex=')) {
    focusable = html.replace('<canvas id=c ', '<canvas id=c tabindex=0 ');
  } else if (html.includes('<canvas id="c"') && !html.includes('tabindex')) {
    focusable = html.replace(/<canvas id="c"([^>]*)>/, '<canvas id="c"$1 tabindex="0">');
  }

  if (!/canvas[^>]*\sid=['"]?c['"]?/i.test(focusable)) {
    throw new Error('Unicorn Stampede artifact no longer exposes the expected canvas shell.');
  }

  if (focusable.includes('/game-runtimes/game-network-bridge.js')) return focusable;
  return focusable.includes('</body>')
    ? focusable.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`)
    : `${focusable}\n${GAME_NETWORK_BRIDGE}\n`;
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
    // Revalidate frequently so Game Network stays close to unicorn-stampede main.
    next: { revalidate: 300 },
  });

  if (!upstream.ok) {
    return new NextResponse('Unicorn Stampede runtime artifact is unavailable from GitHub main.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const html = await upstream.text();
  if (!html.includes('<title>Unicorn Stampede</title>') && !/<title>[^<]*Unicorn Stampede/i.test(html)) {
    return new NextResponse('Unicorn Stampede runtime artifact failed its identity check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let body: string;
  try {
    body = prepareForGameNetwork(html);
  } catch {
    return new NextResponse('Unicorn Stampede runtime artifact failed its host integration check.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short browser cache; server revalidates against main every 5 minutes.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Unicorn-Stampede-Source-Ref': UNICORN_STAMPEDE_SOURCE_REF,
      'X-Unicorn-Stampede-Source-Artifact': UNICORN_STAMPEDE_SOURCE_ARTIFACT,
    },
  });
}
