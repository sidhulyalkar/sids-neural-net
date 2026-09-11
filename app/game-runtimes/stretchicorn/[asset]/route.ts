import { NextResponse } from 'next/server';

/** Live-tracking tip of stretchicorn main (qualified local-playable build). */
const STRETCHICORN_SOURCE_REF = 'main';
const STRETCHICORN_SOURCE_ARTIFACT = 'dist/stretchicorn-local.html';
const SOURCE_URL = `https://raw.githubusercontent.com/sidhulyalkar/stretchicorn/${STRETCHICORN_SOURCE_REF}/${STRETCHICORN_SOURCE_ARTIFACT}`;
const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';
const FILL_SHELL_STYLE =
  '<style data-sids-game-network-fill>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}body{display:block}canvas{width:100%!important;height:100%!important;max-width:none!important;display:block;cursor:crosshair}</style>';

/**
 * Packed js13k builds decompress via eval(r). Without 'unsafe-eval' the browser
 * blocks bootstrap and the cabinet shows a blank canvas.
 */
const STRETCHICORN_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; frame-ancestors 'self';";

type StretchicornRuntimeRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

function ensureStretchicornTitle(html: string) {
  if (/<title>[^<]*Stretchicorn/i.test(html)) return html;
  // Packed js13k builds may omit <title>; inject a stable host title for a11y/tabs.
  if (/<!doctype html>/i.test(html)) {
    return html.replace(/<!doctype html>/i, '<!doctype html><title>Stretchicorn</title>');
  }
  return `<title>Stretchicorn</title>${html}`;
}

function prepareForGameNetwork(html: string) {
  const titled = ensureStretchicornTitle(html);

  // Pack builds center a max-960px canvas on a full-viewport body, which leaves
  // grey letterbox bars inside a larger host iframe. Force the canvas to fill.
  let shell = titled;
  if (!shell.includes('data-sids-game-network-fill')) {
    if (/<head[^>]*>/i.test(shell)) {
      shell = shell.replace(/<head[^>]*>/i, (m) => `${m}${FILL_SHELL_STYLE}`);
    } else if (/<!doctype html>/i.test(shell)) {
      shell = shell.replace(/<!doctype html>/i, (m) => `${m}${FILL_SHELL_STYLE}`);
    } else {
      shell = `${FILL_SHELL_STYLE}${shell}`;
    }
  }

  // Ensure the canvas can receive keyboard focus inside the Game Network shell.
  let focusable = shell;
  if (shell.includes('<canvas id=c ') && !shell.includes('<canvas id=c tabindex=')) {
    focusable = shell.replace('<canvas id=c ', '<canvas id=c tabindex=0 ');
  } else if (/<canvas id="c"/i.test(shell) && !/tabindex=/i.test(shell)) {
    focusable = shell.replace(/<canvas id="c"([^>]*)>/i, '<canvas id="c"$1 tabindex="0">');
  }

  if (!/<canvas[^>]*\sid=['"]?c['"]?/i.test(focusable)) {
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

  // Never serve a stale Data Cache copy — Game Network must track stretchicorn main tip.
  const upstream = await fetch(SOURCE_URL, {
    headers: {
      Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new NextResponse('Stretchicorn runtime artifact is unavailable from GitHub main.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const html = await upstream.text();
  // Readable builds carry a Stretchicorn title; packed builds still expose canvas#c.
  const hasTitle = /<title>[^<]*Stretchicorn/i.test(html);
  const hasCanvas = /<canvas[^>]*\sid=['"]?c['"]?/i.test(html);
  if (!hasTitle && !hasCanvas) {
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
      // Short private browser cache only — never pin a long-lived edge copy of main.
      'Cache-Control': 'private, max-age=30, must-revalidate',
      'Content-Security-Policy': STRETCHICORN_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Stretchicorn-Source-Ref': STRETCHICORN_SOURCE_REF,
      'X-Stretchicorn-Source-Artifact': STRETCHICORN_SOURCE_ARTIFACT,
      'X-Stretchicorn-Upstream-Bytes': String(html.length),
    },
  });
}
