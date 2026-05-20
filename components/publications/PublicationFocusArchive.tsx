'use client';

import { ExternalLink, FileText } from 'lucide-react';
import type { NeuralNode } from '@/lib/data/schemas';
import type { OpenAlexPublicationEnhancement } from '@/lib/openalex';
import { TagPill, getTagColor } from '@/components/ui';

type PublicationFocusArchiveProps = {
  publications: NeuralNode[];
  enhancements: Record<string, OpenAlexPublicationEnhancement>;
};

function publicationLinks(publication: NeuralNode, enhancement?: OpenAlexPublicationEnhancement) {
  const pub = publication.publication;
  const links: Array<{ label: string; href: string; kind: 'pdf' | 'abstract' | 'reference' }> = [];

  if (pub?.localPdfPath) {
    links.push({ label: 'PDF', href: pub.localPdfPath, kind: 'pdf' });
  }

  (pub?.externalLinks ?? []).forEach((link) => {
    const isPdf = link.href.toLowerCase().includes('.pdf') || link.label.toLowerCase().includes('pdf');
    links.push({ label: link.label, href: link.href, kind: isPdf ? 'pdf' : 'reference' });
  });

  if (pub?.doi && !links.some((link) => link.href.includes(pub.doi as string))) {
    links.push({ label: 'DOI', href: `https://doi.org/${pub.doi}`, kind: 'reference' });
  }

  if (pub?.pmid && !links.some((link) => link.href.includes(pub.pmid as string))) {
    links.push({ label: 'PubMed', href: `https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}`, kind: 'abstract' });
  }

  if (pub?.pmcid && !links.some((link) => link.href.includes(pub.pmcid as string))) {
    links.push({ label: 'PMC', href: `https://pmc.ncbi.nlm.nih.gov/articles/${pub.pmcid}/`, kind: 'abstract' });
  }

  if (enhancement?.landingPageUrl) {
    links.push({ label: 'OpenAlex source', href: enhancement.landingPageUrl, kind: 'reference' });
  }

  return links;
}

export function PublicationFocusArchive({ publications, enhancements }: PublicationFocusArchiveProps) {
  return (
    <section className="publication-focus-shell">
      <div className="mb-8 border-b border-white/10 pb-5">
        <h2 className="font-mono text-xl font-light uppercase tracking-[0.16em] text-text-primary">
          Publication references
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {publications.map((publication, index) => {
          const pub = publication.publication;
          const enhancement = enhancements[publication.id];
          const links = publicationLinks(publication, enhancement);
          const venueParts = [pub?.venue, pub?.year?.toString()].filter(Boolean);

          return (
            <article
              key={publication.id}
              className="publication-paper-block min-w-0 overflow-hidden p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.66rem] uppercase leading-5 tracking-[0.18em] text-text-muted [overflow-wrap:anywhere]">
                  {venueParts.map((part, partIndex) => (
                    <span key={part} className="max-w-full break-words">
                      {partIndex > 0 && <span className="mr-2 text-text-muted/70">/</span>}
                      {part}
                    </span>
                  ))}
                </p>
              </div>

              <h3 className="text-pretty text-xl font-semibold leading-tight text-text-primary [overflow-wrap:anywhere]">
                {publication.title}
              </h3>

              {pub?.authors && pub.authors.length > 0 && (
                <p className="mt-3 text-pretty text-sm leading-6 text-text-muted [overflow-wrap:anywhere]">
                  {pub.authors.join(', ')}
                </p>
              )}

              <p className="mt-4 text-pretty text-sm leading-6 text-text-secondary [overflow-wrap:anywhere]">
                {pub?.abstract || enhancement?.abstract || publication.summary || 'Abstract slot ready for this publication.'}
              </p>

              <div className="mt-4 flex min-w-0 flex-wrap gap-1.5">
                {[...(enhancement?.topics ?? []), ...publication.tags].slice(0, 6).map((tag, tagIndex) => (
                  <TagPill key={`${publication.id}-${tag}-${tagIndex}`} color={getTagColor(tag)} size="sm" wrap>
                    {tag}
                  </TagPill>
                ))}
              </div>

              <div className="mt-5 flex min-w-0 flex-wrap gap-x-3 gap-y-2 border-t border-white/10 pt-4">
                {links.map((link) => (
                  <a
                    key={`${publication.id}-${link.label}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-2 text-sm text-cyan hover:text-cyan-100"
                    aria-label={`Open ${link.label} for ${publication.title}`}
                  >
                    {link.kind === 'pdf' ? <FileText className="h-4 w-4 shrink-0" /> : <ExternalLink className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{link.label}</span>
                  </a>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
