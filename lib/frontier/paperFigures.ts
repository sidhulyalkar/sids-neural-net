import type { FrontierFeedResponse, FrontierItem, FrontierSourceFigure } from './types';

const ARXIV_HOST = 'arxiv.org';
const FIGURE_LIMIT = 2;
const MAX_HTML_BYTES = 1_400_000;
const DEFAULT_TIMEOUT_MS = 4200;
const HTML_PREFIX = '/html/';

export type ArxivFigureEnrichmentReport = {
  attempted: number;
  papersWithFigures: number;
  figuresAdded: number;
  source: 'arxiv-html';
};

function arxivIdFromItem(item: FrontierItem): string | null {
  if (item.sourceKind !== 'arxiv') return null;
  try {
    const uri = new URL(item.url);
    if (uri.protocol !== 'https:' || uri.hostname !== ARXIV_HOST || uri.username || uri.password) return null;
    const path = uri.pathname.split('/').filter(Boolean);
    if (path.length !== 2 || !['abs', 'pdf'].includes(path[0])) return null;
    const id = path[1].replace(/\.pdf$/i, '');
    return /^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    const names: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    const normalized = entity.toLowerCase();
    if (normalized in names) return names[normalized];
    const cp = normalized.startsWith('#x') ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
      ? String.fromCodePoint(cp) : match;
  });
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp('(?:\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\x27([^\x27]*)\x27)', 'i');
  const hit = tag.match(re);
  return hit ? decodeEntities(hit[1] ?? hit[2] ?? '').trim() : null;
}

function readableText(fragment: string): string {
  return decodeEntities(fragment.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')).replace(/\s+/g, ' ').trim();
}

function sourceImageUrl(raw: string, paperId: string): string | null {
  try {
    const normalized = new URL(raw, 'https://' + ARXIV_HOST + HTML_PREFIX + paperId + '/');
    if (normalized.protocol !== 'https:' || normalized.hostname !== ARXIV_HOST
      || normalized.username || normalized.password || normalized.hash
      || !normalized.pathname.startsWith(HTML_PREFIX + paperId + '/')
      || !/\.(?:png|jpe?g|webp)$/i.test(normalized.pathname)
      || normalized.href.length > 1000) return null;
    return normalized.href;
  } catch {
    return null;
  }
}

/** Only a figure-wrapped original raster and its corresponding source caption
 * count as verified. Never guess figure panels from a random PDF image. */
export function extractArxivHtmlFigures(html: string, paperId: string, limit = FIGURE_LIMIT): FrontierSourceFigure[] {
  if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(paperId)) return [];
  const figures: FrontierSourceFigure[] = [];
  const seen = new Set<string>();
  const safeLimit = Math.min(4, Math.max(0, Math.floor(limit)));
  for (const match of html.matchAll(/<figure\b([^>]*\bclass\s*=\s*["'][^"']*\bltx_figure\b[^"']*["'][^>]*)>([\s\S]*?)<\/figure>/gi)) {
    if (figures.length >= safeLimit) break;
    const openingTag = '<figure ' + match[1] + '>';
    const body = match[2];
    if (/\bltx_table\b/.test(match[1])) continue;
    const imageTag = body.match(/<img\b[^>]*>/i)?.[0];
    const captionMatch = body.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
    if (!imageTag || !captionMatch) continue;
    const rawUrl = attr(imageTag, 'src');
    const caption = readableText(captionMatch[1]).slice(0, 640);
    if (!rawUrl || caption.length < 20) continue;
    const imageUrl = sourceImageUrl(rawUrl, paperId);
    if (!imageUrl || seen.has(imageUrl)) continue;
    const label = attr(imageTag, 'alt') || caption.slice(0, 180);
    const figureId = attr(openingTag, 'id');
    const sourceUrl = 'https://' + ARXIV_HOST + HTML_PREFIX + paperId
      + (figureId && /^[\w:.-]{1,100}$/.test(figureId) ? '#' + encodeURIComponent(figureId) : '');
    seen.add(imageUrl);
    figures.push({
      url: imageUrl,
      alt: label.slice(0, 200),
      caption,
      credit: 'arXiv · original paper figure',
      sourceUrl,
    });
  }
  return figures;
}

async function boundedText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_HTML_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_HTML_BYTES) break;
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
}

/** Offline/scheduled only: fetching is never part of the initial page render.
 * Fail closed to the original summary when HTML or real figures are missing. */
export async function fetchArxivHtmlFigures(
  item: FrontierItem,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FrontierSourceFigure[]> {
  const paperId = arxivIdFromItem(item);
  if (!paperId || item.figures?.length) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = 'https://' + ARXIV_HOST + HTML_PREFIX + paperId;
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      cache: 'no-store',
    });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) return [];
    const final = new URL(response.url || url);
    if (final.protocol !== 'https:' || final.hostname !== ARXIV_HOST
      || !final.pathname.startsWith(HTML_PREFIX + paperId)) return [];
    const html = await boundedText(response);
    return extractArxivHtmlFigures(html, paperId);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichFrontierPaperFigures(
  feed: FrontierFeedResponse,
  options: {
    maxPapers?: number;
    minIntervalMs?: number;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<{ feed: FrontierFeedResponse; report: ArxivFigureEnrichmentReport }> {
  const maxPapers = Math.min(6, Math.max(0, Math.floor(options.maxPapers ?? 3)));
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? 1500);
  const out = [...feed.items];
  let attempted = 0;
  let papersWithFigures = 0;
  let figuresAdded = 0;
  for (let i = 0; i < out.length && attempted < maxPapers; i++) {
    const item = out[i];
    if (!arxivIdFromItem(item) || item.figures?.length) continue;
    if (attempted > 0 && minIntervalMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, minIntervalMs));
    }
    attempted++;
    const figures = await fetchArxivHtmlFigures(item, options.fetchImpl, options.timeoutMs);
    if (!figures.length) continue;
    out[i] = { ...item, figures };
    papersWithFigures++;
    figuresAdded += figures.length;
  }
  return {
    feed: { ...feed, items: out },
    report: { attempted, papersWithFigures, figuresAdded, source: 'arxiv-html' },
  };
}
