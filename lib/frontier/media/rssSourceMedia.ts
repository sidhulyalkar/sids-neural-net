import type { FrontierMedia } from '../types';

const IMAGE_EXT = /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i;
const VIDEO_EXT = /\.(?:m3u8|mp4|m4v|webm)(?:$|[?#])/i;

function decodeAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function stripMarkup(value: string): string {
  return decodeAttribute(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagText(block: string, tag: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match?.[1] ? stripMarkup(match[1]) : '';
}

function tagOpen(block: string, tag: string): string | undefined {
  const escaped = tag.replace(':', '\\:');
  return block.match(new RegExp(`<${escaped}\\b[^>]*\/?>`, 'i'))?.[0];
}

function attr(openTag: string | undefined, name: string): string {
  if (!openTag) return '';
  const match = openTag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match?.[1] ? decodeAttribute(match[1]) : '';
}

function numericAttr(openTag: string | undefined, name: string): number | undefined {
  const value = Number(attr(openTag, name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function httpUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'source']) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return value;
  }
}

function firstEmbeddedImage(block: string): string | undefined {
  const match = block.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return httpUrl(match?.[1] ? decodeAttribute(match[1]) : '');
}

function imageMedia(url: string, title: string, openTag?: string): FrontierMedia {
  const width = numericAttr(openTag, 'width');
  const height = numericAttr(openTag, 'height');
  return {
    type: 'image',
    url,
    alt: title,
    aspectRatio: width && height
      ? width / height > 1.65 ? 'wide' : width / height < 0.82 ? 'portrait' : 'landscape'
      : 'landscape',
    width,
    height,
  };
}

function mediaFromBlock(block: string, title: string): FrontierMedia | undefined {
  const mediaContent = tagOpen(block, 'media:content');
  const mediaUrl = httpUrl(attr(mediaContent, 'url'));
  const mediaType = attr(mediaContent, 'type').toLowerCase();
  const mediaKind = attr(mediaContent, 'medium').toLowerCase();

  const thumbnailTag = tagOpen(block, 'media:thumbnail');
  const thumbnail = httpUrl(attr(thumbnailTag, 'url'));

  const enclosure = tagOpen(block, 'enclosure');
  const enclosureUrl = httpUrl(attr(enclosure, 'url'));
  const enclosureType = attr(enclosure, 'type').toLowerCase();

  const mediaIsVideo = Boolean(mediaUrl && (mediaKind === 'video' || mediaType.startsWith('video/') || VIDEO_EXT.test(mediaUrl)));
  if (mediaIsVideo) {
    return {
      type: 'video',
      url: mediaUrl,
      poster: thumbnail,
      alt: title,
      aspectRatio: 'wide',
      width: numericAttr(mediaContent, 'width'),
      height: numericAttr(mediaContent, 'height'),
    };
  }

  const mediaIsImage = Boolean(mediaUrl && (mediaKind === 'image' || mediaType.startsWith('image/') || IMAGE_EXT.test(mediaUrl)));
  if (mediaIsImage && mediaUrl) return imageMedia(mediaUrl, title, mediaContent);
  if (thumbnail) return imageMedia(thumbnail, title, thumbnailTag);

  if (enclosureUrl && (enclosureType.startsWith('video/') || VIDEO_EXT.test(enclosureUrl))) {
    return { type: 'video', url: enclosureUrl, poster: thumbnail, alt: title, aspectRatio: 'wide' };
  }
  if (enclosureUrl && (enclosureType.startsWith('image/') || IMAGE_EXT.test(enclosureUrl))) {
    return imageMedia(enclosureUrl, title, enclosure);
  }

  const embedded = firstEmbeddedImage(block);
  return embedded ? imageMedia(embedded, title) : undefined;
}

/**
 * Extract only media explicitly carried by an RSS/Atom item. No article-page
 * scraping and no synthetic fallback art. Keys use the same canonical URL
 * policy as the source ingestor so this map can decorate semantic items later.
 */
export function frontierRssSourceMedia(xml: string): Map<string, FrontierMedia> {
  const blocks = [
    ...Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi), (match) => match[1]),
    ...Array.from(xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi), (match) => match[1]),
  ];
  const media = new Map<string, FrontierMedia>();

  for (const block of blocks) {
    const title = tagText(block, 'title') || 'Source visual';
    const link = tagText(block, 'link') || attr(tagOpen(block, 'link'), 'href') || tagText(block, 'guid') || tagText(block, 'id');
    const canonical = httpUrl(link);
    if (!canonical) continue;
    const sourceMedia = mediaFromBlock(block, title);
    if (sourceMedia) media.set(canonicalUrl(canonical), sourceMedia);
  }
  return media;
}

export function frontierRssMediaForUrl(media: Map<string, FrontierMedia>, itemUrl: string): FrontierMedia | undefined {
  return media.get(canonicalUrl(itemUrl));
}
