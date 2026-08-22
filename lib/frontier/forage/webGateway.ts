import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPrivateAddress } from '@/lib/frontier/media/proxySecurity';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const HTML_MAX_BYTES = 240_000;
const FEED_MAX_BYTES = 760_000;
const USER_AGENT = 'sids-neural-net-frontier-forager/1.0 (+https://sidhulyalkar.com/frontier)';
const SENSITIVE_QUERY_KEY = /(?:^|_)(?:access_?token|auth|authorization|api_?key|secret|session|signature|sig|password|passwd|code)(?:$|_)/i;

export type FrontierForageFetchMode = 'html' | 'feed';

export type FrontierForageFetchResult = {
  finalUrl: string;
  contentType: string;
  text: string;
};

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function hasSensitiveQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) if (SENSITIVE_QUERY_KEY.test(key)) return true;
  return false;
}

export async function assertSafePublicForageUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Autonomous foraging accepts HTTPS sources only');
  if (url.username || url.password) throw new Error('Source credentials are not allowed');
  if (url.port && url.port !== '443') throw new Error('Non-standard source ports are not allowed');
  if (hasSensitiveQuery(url)) throw new Error('Source URL contains a sensitive query parameter');
  const host = normalizedHostname(url.hostname);
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Local source hosts are not allowed');
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Source address is private or unsafe');
    return url;
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Source host resolved to a private or unsafe address');
  }
  return url;
}

function allowedContentType(mode: FrontierForageFetchMode, raw: string): boolean {
  const contentType = raw.split(';', 1)[0].trim().toLowerCase();
  if (mode === 'html') return contentType === 'text/html' || contentType === 'application/xhtml+xml';
  return contentType === 'application/rss+xml'
    || contentType === 'application/atom+xml'
    || contentType === 'application/xml'
    || contentType === 'text/xml'
    || contentType === 'text/plain';
}

async function readBoundedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('Source payload exceeds FRONTIER byte limit');
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Source payload exceeds FRONTIER byte limit');
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    if (signal.aborted || total > maxBytes) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function fetchBoundedPublicForageText(
  raw: string,
  mode: FrontierForageFetchMode,
  outerSignal?: AbortSignal
): Promise<FrontierForageFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  outerSignal?.addEventListener('abort', abort, { once: true });
  const maxBytes = mode === 'html' ? HTML_MAX_BYTES : FEED_MAX_BYTES;

  try {
    let current = await assertSafePublicForageUrl(raw);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(current, {
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: mode === 'html'
            ? 'text/html,application/xhtml+xml;q=0.9'
            : 'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain;q=0.7',
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === MAX_REDIRECTS) throw new Error('Source redirect limit exceeded');
        current = await assertSafePublicForageUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) throw new Error(`Source returned ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!allowedContentType(mode, contentType)) throw new Error(`Unsupported source content type: ${contentType || 'unknown'}`);
      const text = await readBoundedBody(response, maxBytes, controller.signal);
      if (!text.trim()) throw new Error('Source returned an empty payload');
      if (mode === 'feed' && !/<(?:rss\b|feed\b|rdf:RDF\b)/i.test(text.slice(0, 8_000))) {
        throw new Error('Endpoint did not return RSS or Atom content');
      }
      return { finalUrl: current.toString(), contentType, text };
    }
    throw new Error('Source redirect resolution failed');
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener('abort', abort);
  }
}
