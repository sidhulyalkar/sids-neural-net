import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { FrontierFeedResponse, FrontierMedia } from '@/lib/frontier/types';

const DEFAULT_MEDIA_HOSTS = new Set([
  'i.ytimg.com',
  'i.redd.it',
  'preview.redd.it',
  'cdn.cloudflare.steamstatic.com',
  'shared.fastly.steamstatic.com',
  'steamcdn-a.akamaihd.net',
]);

function configuredHosts(): Set<string> {
  const values = (process.env.FRONTIER_MEDIA_PROXY_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);
  return new Set([...DEFAULT_MEDIA_HOSTS, ...values]);
}

export function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  for (const allowed of configuredHosts()) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

function isNonPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts as [number, number, number, number];

  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function isNonPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const dottedMapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMapped?.[1]) return isNonPublicIpv4(dottedMapped[1]);

  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized === '2001:db8::' ||
    normalized.startsWith('2001:db8:');
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isNonPublicIpv4(address);
  if (version === 6) return isNonPublicIpv6(address);
  return true;
}

export async function assertSafeMediaUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported media protocol');
  if (url.username || url.password) throw new Error('Media credentials are not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('Non-standard media ports are not allowed');
  if (!isAllowedMediaHost(url.hostname)) throw new Error('Media host is not trusted for proxying');

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Media host resolved to a private or unsafe address');
  }
  return url;
}

function proxyPath(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!isAllowedMediaHost(url.hostname)) return undefined;
    if (url.port && url.port !== '80' && url.port !== '443') return undefined;
    return `/api/frontier/media?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return undefined;
  }
}

function decorateMedia(media?: FrontierMedia): FrontierMedia | undefined {
  if (!media) return media;
  if (media.type === 'image') {
    const proxyUrl = proxyPath(media.url);
    return proxyUrl ? { ...media, proxyUrl } : media;
  }
  if (media.type === 'video' || media.type === 'youtube') {
    const posterProxyUrl = proxyPath(media.poster);
    return posterProxyUrl ? { ...media, posterProxyUrl } : media;
  }
  return media;
}

export function decorateFeedMedia(feed: FrontierFeedResponse): FrontierFeedResponse {
  return {
    ...feed,
    items: feed.items.map((item) => ({ ...item, media: decorateMedia(item.media) })),
  };
}
