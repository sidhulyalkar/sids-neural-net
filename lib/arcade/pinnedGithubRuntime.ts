import { NextResponse } from 'next/server';

export type PinnedGithubRuntime = {
  owner: string;
  repo: string;
  commit: string;
  allowedAssets: ReadonlySet<string>;
};

const GAME_NETWORK_BRIDGE = '<script src="/game-runtimes/game-network-bridge.js"></script>';
const SAFE_ASSET_PATH = /^[a-zA-Z0-9._/-]+$/;

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

const RUNTIME_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "media-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

function injectGameNetworkBridge(html: string) {
  if (html.includes('/game-runtimes/game-network-bridge.js')) return html;

  const firstScript = html.indexOf('<script');
  if (firstScript >= 0) {
    return `${html.slice(0, firstScript)}${GAME_NETWORK_BRIDGE}${html.slice(firstScript)}`;
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', `${GAME_NETWORK_BRIDGE}</body>`);
  }

  return `${html}\n${GAME_NETWORK_BRIDGE}\n`;
}

function isAllowedAsset(path: string, runtime: PinnedGithubRuntime) {
  return (
    path.length > 0 &&
    SAFE_ASSET_PATH.test(path) &&
    !path.startsWith('/') &&
    !path.includes('..') &&
    runtime.allowedAssets.has(path)
  );
}

export async function servePinnedGithubRuntimeAsset(
  runtime: PinnedGithubRuntime,
  assetSegments: string[]
) {
  const path = assetSegments.join('/');
  if (!isAllowedAsset(path, runtime)) {
    return new NextResponse('Unknown arcade runtime asset.', { status: 404 });
  }

  const sourceUrl = `https://raw.githubusercontent.com/${runtime.owner}/${runtime.repo}/${runtime.commit}/${path}`;

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      headers: { Accept: 'text/plain,*/*;q=0.8' },
      cache: 'force-cache',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return new NextResponse('Pinned arcade runtime source is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!upstream.ok) {
    return new NextResponse('Pinned arcade runtime source is unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = path.split('.').pop()?.toLowerCase() ?? 'txt';
  const body = path === 'index.html'
    ? injectGameNetworkBridge(await upstream.text())
    : await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': RUNTIME_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Arcade-Upstream-Repo': `${runtime.owner}/${runtime.repo}`,
      'X-Arcade-Upstream-Commit': runtime.commit,
    },
  });
}
