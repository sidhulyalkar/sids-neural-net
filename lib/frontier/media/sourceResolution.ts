const GUARDIAN_IMAGE_HOST = 'i.guim.co.uk';
const FRONTIER_HD_TARGET_WIDTH = 2048;
const FRONTIER_HD_MIN_QUALITY = 88;

function sourceMasterWidth(pathname: string): number | undefined {
  const match = pathname.match(/\/master\/(\d+)\.(?:jpe?g|png|webp)$/i);
  if (!match?.[1]) return undefined;
  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : undefined;
}

/**
 * Return a source-authentic higher-resolution variant when the publisher exposes
 * a documented image-transform URL. This never invents imagery or changes its
 * editorial identity. The original URL remains the browser-native fallback.
 *
 * Guardian RSS commonly publishes a 140px thumbnail even when the URL path
 * identifies a multi-thousand-pixel master. FRONTIER may display that image in
 * an 8-column high-DPR card, so stretching the RSS thumbnail is visibly soft.
 * Request a bounded 2048px first-party transform instead, capped by the master
 * width. The media plane still applies device/network decode limits afterward.
 */
export function preferredFrontierImageSource(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== GUARDIAN_IMAGE_HOST) return raw;

    const requestedWidth = Number(url.searchParams.get('width') ?? '0');
    if (!Number.isFinite(requestedWidth) || requestedWidth <= 0 || requestedWidth >= FRONTIER_HD_TARGET_WIDTH) return raw;

    const masterWidth = sourceMasterWidth(url.pathname);
    const targetWidth = Math.max(
      requestedWidth,
      Math.min(FRONTIER_HD_TARGET_WIDTH, masterWidth ?? FRONTIER_HD_TARGET_WIDTH),
    );
    if (targetWidth <= requestedWidth) return raw;

    url.searchParams.set('width', String(Math.round(targetWidth)));
    const quality = Number(url.searchParams.get('quality') ?? '0');
    if (!Number.isFinite(quality) || quality < FRONTIER_HD_MIN_QUALITY) {
      url.searchParams.set('quality', String(FRONTIER_HD_MIN_QUALITY));
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function frontierDeclaredImageWidth(raw: string): number | undefined {
  try {
    const url = new URL(raw);
    const explicit = Number(url.searchParams.get('width') ?? '0');
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return sourceMasterWidth(url.pathname);
  } catch {
    return undefined;
  }
}


/**
 * Source-authentic resolution ladder, never an AI upscale. The initial URL is
 * already the HD transform/poster; these are bounded fallback source variants.
 */
export function frontierImageResolutionFallbacks(raw: string): string[] {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return [];
    if (url.hostname === 'i.ytimg.com') {
      const match = url.pathname.match(/^\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\/(maxresdefault|sddefault|hqdefault)\.(jpg|webp)$/);
      if (!match) return [];
      const videoId = match[1];
      return ['sddefault', 'hqdefault']
        .map((size) => new URL('/vi/' + videoId + '/' + size + '.jpg', url.origin).toString())
        .filter((candidate) => candidate !== raw);
    }
    if (url.hostname === GUARDIAN_IMAGE_HOST) {
      const width = frontierDeclaredImageWidth(raw);
      if (width && width >= 800) return [];
      const retry = new URL(raw);
      retry.searchParams.set('width', '1200');
      retry.searchParams.set('quality', '85');
      return retry.toString() === raw ? [] : [retry.toString()];
    }
    return [];
  } catch {
    return [];
  }
}
