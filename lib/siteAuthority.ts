export const CANONICAL_SITE_URL = 'https://sidhulyalkar.com' as const;

export function canonicalSiteUrl(path = ''): string {
  if (!path) return CANONICAL_SITE_URL;
  return `${CANONICAL_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
