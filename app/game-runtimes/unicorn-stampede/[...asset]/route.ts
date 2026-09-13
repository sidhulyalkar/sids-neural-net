import { NextResponse } from 'next/server';

/** Live-tracking tip of Unicorn Stampede main (readable post-js13k showcase build). */
const UNICORN_STAMPEDE_SOURCE_REF = 'main';
const SOURCE_ROOT = `https://raw.githubusercontent.com/sidhulyalkar/unicorn-stampede/${UNICORN_STAMPEDE_SOURCE_REF}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';

const ALLOWED_ASSETS = new Set([
  'index.html',
  'src/style.css',
  'src/showcase.css',
  'src/core.js',
  'src/herd.js',
  'src/render.js',
  'src/ui.js',
  'src/top10.js',
  'src/polish.js',
  'src/input-guard.js',
  'src/whip.js',
  'src/worlds.js',
  'src/expansion.js',
  'src/showcase.js',
  'src/showcase-world-motion.js',
  'src/showcase-settings.js',
  'src/showcase-audio.js',
  'src/showcase-input.js',
  'src/showcase-stats.js',
  'src/showcase-shell.js',
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

function prepareForGameNetwork(html: string) {
  let focusable = html;
  if (/<canvas\s+id=["']game["'][^>]*>/i.test(focusable) && !/<canvas\s+id=["']game["'][^>]*tabindex=/i.test(focusable)) {
    focusable = focusable.replace(/<canvas\s+id=["']game["']([^>]*)>/i, '<canvas id="game"$1 tabindex="0">');
  }

  if (!/<canvas[^>]*\sid=["']game["']/i.test(focusable)) {
    throw new Error('Unicorn Stampede showcase no longer exposes the expected game canvas.');
  }

  if (focusable.includes('/game-runtimes/game-network-bridge.js')) return focusable;
  return focusable.includes('</body>')
    ? focusable.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`)
    : `${focusable}\n${GAME_NETWORK_BRIDGE}\n`;
}

export async function GET(_request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  const path = asset.join('/');

  if (!ALLOWED_ASSETS.has(path)) {
    return new NextResponse('Unknown Unicorn Stampede runtime asset.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const upstream = await fetch(`${SOURCE_ROOT}/${path}`, {
    headers: {
      Accept: path.endsWith('.html') ? 'text/html,text/plain;q=0.9,*/*;q=0.8' : 'text/plain,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new NextResponse('Unicorn Stampede showcase asset is unavailable from GitHub main.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = path.split('.').pop() ?? 'txt';
  let body: BodyInit;
  if (path === 'index.html') {
    const html = await upstream.text();
    if (!/<title>[^<]*Unicorn Stampede/i.test(html) || !/showcase/i.test(html)) {
      return new NextResponse('Unicorn Stampede showcase failed its identity check.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    try {
      body = prepareForGameNetwork(html);
    } catch {
      return new NextResponse('Unicorn Stampede showcase failed its host integration check.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } else {
    body = await upstream.arrayBuffer();
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'private, max-age=30, must-revalidate',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Unicorn-Stampede-Source-Ref': UNICORN_STAMPEDE_SOURCE_REF,
      'X-Unicorn-Stampede-Source-Asset': path,
    },
  });
}
