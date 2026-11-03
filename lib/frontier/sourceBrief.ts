import type { FrontierItem, FrontierSourceFigure } from './types';
import { cleanFrontierEditorialText } from './editorialQuality';
import { frontierImageResolutionFallbacks } from './media/sourceResolution';

/**
 * The focus reader re-arranges the *existing source payload*; it does not
 * synthesize facts, infer unsupported conclusions, or invent illustrations.
 */
export type FrontierSourceBrief = {
  lead: string;
  details: string[];
  hasFullerContext: boolean;
  /** True only when the supplied publisher preview itself ends with an ellipsis. */
  previewTruncated?: true;
};

function readableSentences(value: string): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  // Split only at punctuation followed by an apparent new sentence. This is
  // presentational, not summarization, and never rewrites source words.
  return normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])/u).map((part) => part.trim()).filter(Boolean);
}

/** Some feeds provide a 1,000-character run-on sentence with no punctuation.
 * Preserve every source word while letting the reader reveal it in stages. */
function splitLongSourceSentence(sentence: string): string[] {
  if (sentence.length <= 360) return [sentence];
  const chunks: string[] = [];
  let remaining = sentence;
  while (remaining.length > 320) {
    let boundary = remaining.lastIndexOf(' ', 320);
    if (boundary < 160) boundary = remaining.indexOf(' ', 320);
    if (boundary < 0) break; // Unbroken source token: never truncate it.
    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary + 1);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function buildFrontierSourceBrief(summary: string, sourceKind = ''): FrontierSourceBrief {
  const text = cleanFrontierEditorialText(summary, sourceKind);
  if (!text) return { lead: '', details: [], hasFullerContext: false };
  const previewTruncated = /(?:…|\\.\\.\\.)\\s*$/u.test(text);
  const sentences = readableSentences(text).flatMap(splitLongSourceSentence);
  const metadata = previewTruncated ? { previewTruncated: true as const } : {};
  if (text.length <= 260 || sentences.length < 2) {
    return { lead: text, details: [], hasFullerContext: false, ...metadata };
  }
  const lead: string[] = [];
  let total = 0;
  let index = 0;
  while (index < sentences.length && (total < 220 || lead.length === 0) && lead.length < 2) {
    lead.push(sentences[index]);
    total += sentences[index].length;
    index += 1;
  }
  // An upstream excerpt ending in “…” is not a complete additional finding.
  // Retain fully supplied sentences and link to the original publication for
  // the rest instead of turning a cut-off fragment into a standalone bullet.
  const details = sentences.slice(index);
  if (previewTruncated && details.length && /(?:…|\\.\\.\\.)\\s*$/u.test(details[details.length - 1])) {
    details.pop();
  }
  return { lead: lead.join(' '), details, hasFullerContext: details.length > 0, ...metadata };
}

function allowedImageUrl(value: string): boolean {
  if (value.startsWith('/api/frontier/media?')) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) return false;
    if (host.includes(':')) return false; // Do not expose local IPv6 literals.
    const parts = host.split('.').map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = parts;
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return host.includes('.');
  } catch {
    return false;
  }
}

export function frontierSourceFigures(item: FrontierItem): FrontierSourceFigure[] {
  const found: FrontierSourceFigure[] = [];
  const seen = new Set<string>();
  const add = (figure: FrontierSourceFigure) => {
    const url = figure.url?.trim();
    if (!url || !allowedImageUrl(url) || seen.has(url) || found.length >= 6) return;
    seen.add(url);
    found.push({
      url,
      fallbackUrl: figure.fallbackUrl && allowedImageUrl(figure.fallbackUrl) && figure.fallbackUrl !== url ? figure.fallbackUrl : undefined,
      fallbackUrls: figure.fallbackUrls?.filter((candidate) => allowedImageUrl(candidate) && candidate !== url).slice(0, 6),
      alt: figure.alt?.trim() || item.title,
      caption: figure.caption?.trim() || '',
      credit: figure.credit?.trim() || item.sourceLabel,
      sourceUrl: figure.sourceUrl,
    });
  };
  const media = item.media;
  if (media) {
    const url = media.type === 'image'
      ? (media.proxyUrl || media.url)
      : ((media.type === 'video' || media.type === 'youtube') ? (media.posterProxyUrl || media.poster) : undefined);
    if (url) {
      const original = media.type === 'image' ? media.url : media.poster;
      const variants = original ? frontierImageResolutionFallbacks(original) : [];
      const alternateUrls = variants.flatMap((variant) => [
        '/api/frontier/media?url=' + encodeURIComponent(variant),
        variant,
      ]);
      add({
      url,
      fallbackUrl: original,
      fallbackUrls: media.type === 'youtube' || media.type === 'video'
        ? [...(original ? [original] : []), ...alternateUrls] : alternateUrls,
      alt: media.alt || item.title,
      caption: media.alt || item.title,
      credit: item.sourceLabel,
    });
    }
  }
  for (const figure of item.figures ?? []) add(figure);
  return found;
}

export function frontierRatingDescription(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Hold to rate';
  if (value <= 2) return 'Low interest';
  if (value <= 4) return 'Not for me';
  if (value <= 6) return 'Worth knowing';
  if (value <= 8) return 'Very interesting';
  return 'Loved it';
}
