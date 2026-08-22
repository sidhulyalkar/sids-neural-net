import { cosineSimilarity } from '../vector/math';

export const FRONTIER_SOURCE_SIMILARITY_MIN = 0.58;
export const FRONTIER_SOURCE_CREDIBILITY_MIN = 0.72;

export type FrontierForageEvidence = 'alternate-feed' | 'feed-link' | 'citation' | 'github' | 'outbound';

export type FrontierForageCandidate = {
  id: string;
  kind: 'feed' | 'domain';
  url: string;
  domain: string;
  label: string;
  contextText: string;
  credibility: number;
  evidence: FrontierForageEvidence[];
};

export type FrontierForageDocument = {
  pageUrl: string;
  contextText: string;
  feeds: FrontierForageCandidate[];
  domains: FrontierForageCandidate[];
};

export type FrontierForageEvaluation = {
  candidate: FrontierForageCandidate;
  similarity: number;
  semanticDistance: number;
  accepted: boolean;
};

const ACADEMIC_HOSTS = [
  'arxiv.org', 'biorxiv.org', 'medrxiv.org', 'openreview.net', 'doi.org',
  'pubmed.ncbi.nlm.nih.gov', 'nature.com', 'science.org', 'acm.org', 'ieee.org',
  'zenodo.org', 'paperswithcode.com',
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripMarkup(value: string): string {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return decodeEntities(match?.[1] ?? '').trim();
}

function metaContent(html: string, name: string): string {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (attribute(tag, 'name') || attribute(tag, 'property')).toLowerCase();
    if (key === name.toLowerCase()) return stripMarkup(attribute(tag, 'content'));
  }
  return '';
}

function firstTagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripMarkup(match[1]) : '';
}

function safePublicCandidate(raw: string, base: string): URL | undefined {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password || url.port) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return undefined;
    // Dynamic foraging never needs literal IP endpoints. Rejecting them client-side
    // also leaves the server DNS/private-address guard as a second independent gate.
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return undefined;
    url.hash = '';
    return url;
  } catch {
    return undefined;
  }
}

function isAcademicHost(host: string): boolean {
  return ACADEMIC_HOSTS.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
}

function candidateCredibility(kind: 'feed' | 'domain', host: string, evidence: FrontierForageEvidence[]): number {
  let score = kind === 'feed' ? 0.80 : 0.56;
  if (evidence.includes('alternate-feed')) score += 0.10;
  if (evidence.includes('citation')) score += 0.10;
  if (evidence.includes('github')) score += 0.08;
  if (isAcademicHost(host)) score += 0.10;
  return clamp(score);
}

function pageContext(html: string, pageUrl: string): string {
  const title = firstTagText(html, 'title');
  const description = metaContent(html, 'description') || metaContent(html, 'og:description');
  const keywords = metaContent(html, 'keywords');
  const h1 = firstTagText(html, 'h1');
  const h2 = firstTagText(html, 'h2');
  return [title, description, keywords, h1, h2, pageUrl].filter(Boolean).join(' · ').slice(0, 3_200);
}

function addCandidate(
  map: Map<string, FrontierForageCandidate>,
  input: Omit<FrontierForageCandidate, 'id' | 'credibility'>
): void {
  const key = `${input.kind}:${input.url.toLowerCase()}`;
  const previous = map.get(key);
  const evidence = Array.from(new Set([...(previous?.evidence ?? []), ...input.evidence]));
  const next: FrontierForageCandidate = {
    ...input,
    id: `forage-${stableHash(key)}`,
    evidence,
    credibility: candidateCredibility(input.kind, input.domain, evidence),
    contextText: [previous?.contextText, input.contextText].filter(Boolean).join(' · ').slice(0, 3_200),
  };
  map.set(key, next);
}

export function extractFrontierSourceGraph(html: string, pageUrl: string): FrontierForageDocument {
  const bounded = html.slice(0, 240_000);
  const context = pageContext(bounded, pageUrl);
  const base = safePublicCandidate(pageUrl, pageUrl);
  const baseHost = base?.hostname.toLowerCase().replace(/^www\./, '') ?? '';
  const feeds = new Map<string, FrontierForageCandidate>();
  const domains = new Map<string, FrontierForageCandidate>();

  for (const match of bounded.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attribute(tag, 'rel').toLowerCase();
    const type = attribute(tag, 'type').toLowerCase();
    const href = attribute(tag, 'href');
    if (!href || !rel.split(/\s+/).includes('alternate') || !/(rss|atom)\+xml/.test(type)) continue;
    const url = safePublicCandidate(href, pageUrl);
    if (!url) continue;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    addCandidate(feeds, {
      kind: 'feed',
      url: url.toString(),
      domain: host,
      label: attribute(tag, 'title') || host,
      contextText: `${context} · ${attribute(tag, 'title')} · ${host}`,
      evidence: ['alternate-feed'],
    });
  }

  let anchorCount = 0;
  for (const match of bounded.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (anchorCount >= 220) break;
    anchorCount += 1;
    const tag = `<a ${match[1]}>`;
    const href = attribute(tag, 'href');
    const url = safePublicCandidate(href, pageUrl);
    if (!url) continue;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const text = stripMarkup(match[2]).slice(0, 220);
    const lowerUrl = url.toString().toLowerCase();
    const feedHint = /(?:\/feed\/?|\/rss\/?|rss\.xml|atom\.xml|feed\.xml)(?:$|[?#])/.test(lowerUrl) || /\b(rss|atom|feed)\b/i.test(text);
    if (feedHint) {
      addCandidate(feeds, {
        kind: 'feed',
        url: url.toString(),
        domain: host,
        label: text || host,
        contextText: `${context} · ${text} · ${host}`,
        evidence: ['feed-link'],
      });
    }

    if (host === baseHost) continue;
    const evidence: FrontierForageEvidence[] = [];
    if (host === 'github.com' || host.endsWith('.github.com')) evidence.push('github');
    if (isAcademicHost(host) || /\b(reference|citation|paper|doi|dataset|code|repository)\b/i.test(text)) evidence.push('citation');
    if (!evidence.length) evidence.push('outbound');
    addCandidate(domains, {
      kind: 'domain',
      url: `https://${host}/`,
      domain: host,
      label: text || host,
      contextText: `${context} · ${text} · ${host}`,
      evidence,
    });
  }

  return {
    pageUrl,
    contextText: context,
    feeds: Array.from(feeds.values()).sort((left, right) => right.credibility - left.credibility || left.url.localeCompare(right.url)).slice(0, 12),
    domains: Array.from(domains.values()).sort((left, right) => right.credibility - left.credibility || left.domain.localeCompare(right.domain)).slice(0, 24),
  };
}

export function evaluateFrontierForageCandidates(
  candidates: FrontierForageCandidate[],
  latentVectors: Map<string, Float32Array>,
  activeState: Float32Array,
  options: { minSimilarity?: number; minCredibility?: number } = {}
): FrontierForageEvaluation[] {
  const minSimilarity = options.minSimilarity ?? FRONTIER_SOURCE_SIMILARITY_MIN;
  const minCredibility = options.minCredibility ?? FRONTIER_SOURCE_CREDIBILITY_MIN;
  return candidates.map((candidate) => {
    const latent = latentVectors.get(candidate.id);
    const similarity = latent && latent.length === activeState.length
      ? Math.max(-1, Math.min(1, cosineSimilarity(latent, activeState)))
      : -1;
    return {
      candidate,
      similarity,
      semanticDistance: 1 - similarity,
      accepted: candidate.kind === 'feed' && similarity >= minSimilarity && candidate.credibility >= minCredibility,
    };
  }).sort((left, right) => Number(right.accepted) - Number(left.accepted) || right.similarity - left.similarity || right.candidate.credibility - left.candidate.credibility);
}
