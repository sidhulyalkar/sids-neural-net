import type { NeuralNode } from '@/lib/data/schemas';

export type OpenAlexPublicationEnhancement = {
  openAlexId?: string;
  citedByCount?: number;
  referencedWorksCount?: number;
  citationSparkline: { year: number; count: number }[];
  abstract?: string;
  openAccessStatus?: string;
  openAccessUrl?: string;
  landingPageUrl?: string;
  primarySource?: string;
  topics: string[];
  fetchedAt?: string;
};

type OpenAlexWork = {
  id?: string;
  cited_by_count?: number;
  referenced_works_count?: number;
  counts_by_year?: Array<{ year?: number; cited_by_count?: number }>;
  abstract_inverted_index?: Record<string, number[]>;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string | null;
  };
  primary_location?: {
    landing_page_url?: string | null;
    pdf_url?: string | null;
    source?: {
      display_name?: string;
    } | null;
  } | null;
  topics?: Array<{
    display_name?: string;
    score?: number;
  }>;
  concepts?: Array<{
    display_name?: string;
    score?: number;
  }>;
};

type OpenAlexWorksResponse = {
  results?: OpenAlexWork[];
};

function abstractFromInvertedIndex(index?: Record<string, number[]>): string | undefined {
  if (!index) return undefined;

  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    positions.forEach((position) => words.push({ word, position }));
  }

  const abstract = words
    .sort((a, b) => a.position - b.position)
    .map((item) => item.word)
    .join(' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/([(])\s+/g, '$1');

  return abstract || undefined;
}

function openAlexRequestUrl(doi: string): string {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', `doi:https://doi.org/${doi}`);
  url.searchParams.set('per_page', '1');

  const email = process.env.OPENALEX_EMAIL || process.env.EMAIL;
  const apiKey = process.env.OPENALEX_API_KEY;

  if (email) url.searchParams.set('mailto', email);
  if (apiKey) url.searchParams.set('api_key', apiKey);

  return url.toString();
}

function normalizeWork(work: OpenAlexWork): OpenAlexPublicationEnhancement {
  const sortedCitations = (work.counts_by_year ?? [])
    .filter((item): item is { year: number; cited_by_count: number } =>
      typeof item.year === 'number' && typeof item.cited_by_count === 'number'
    )
    .sort((a, b) => a.year - b.year)
    .slice(-8)
    .map((item) => ({ year: item.year, count: item.cited_by_count }));

  const topics = [...(work.topics ?? []), ...(work.concepts ?? [])]
    .filter((item) => item.display_name)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((item) => item.display_name as string);

  return {
    openAlexId: work.id,
    citedByCount: work.cited_by_count,
    referencedWorksCount: work.referenced_works_count,
    citationSparkline: sortedCitations,
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
    openAccessStatus: work.open_access?.oa_status,
    openAccessUrl: work.open_access?.oa_url || work.primary_location?.pdf_url || undefined,
    landingPageUrl: work.primary_location?.landing_page_url || undefined,
    primarySource: work.primary_location?.source?.display_name,
    topics,
    fetchedAt: new Date().toISOString(),
  };
}

async function getOpenAlexWorkByDoi(doi: string): Promise<OpenAlexPublicationEnhancement | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(openAlexRequestUrl(doi), {
      next: { revalidate: 60 * 60 * 12 },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as OpenAlexWorksResponse;
    const work = payload.results?.[0];
    return work ? normalizeWork(work) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOpenAlexPublicationEnhancements(
  publications: NeuralNode[]
): Promise<Record<string, OpenAlexPublicationEnhancement>> {
  const entries = await Promise.all(
    publications.map(async (publication) => {
      const doi = publication.publication?.doi;
      if (!doi) return null;

      const enhancement = await getOpenAlexWorkByDoi(doi);
      return enhancement ? [publication.id, enhancement] as const : null;
    })
  );

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, OpenAlexPublicationEnhancement]>);
}
