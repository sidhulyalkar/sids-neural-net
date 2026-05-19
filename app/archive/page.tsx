import type { Metadata } from 'next';
import Link from 'next/link';
import { Archive, BookOpen, FileText, NotebookTabs } from 'lucide-react';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { getAllCaseStudies } from '@/lib/content/load-case-studies';
import { BackToAtlasButton, EmptyState, ExternalLinkChip, PageHeader, PageShell, SectionShell } from '@/components/portfolio/PageShell';
import { TagPill, getTagColor } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Archive',
  description:
    'Extended archive for Sidharth Hulyalkar: publications, case studies, paper PDFs, field notes, and long-form technical artifacts.',
  alternates: {
    canonical: '/archive',
  },
  openGraph: {
    title: 'Archive | Sid Neural Net',
    description: 'Extended papers, project case studies, field notes, and technical artifacts.',
    url: '/archive',
  },
};

export default function ArchivePage() {
  const graph = NeuralGraphSchema.parse(graphData);
  const publications = graph.nodes
    .filter((node) => node.type === 'publication')
    .sort((a, b) => (b.publication?.year ?? 0) - (a.publication?.year ?? 0));
  const caseStudies = getAllCaseStudies();

  return (
    <PageShell>
      <PageHeader
        eyebrow="long memory"
        title="archive"
        actions={
          <>
            <ExternalLinkChip href="/publications" external={false}>
              Publications
            </ExternalLinkChip>
            <ExternalLinkChip href="/case-studies" external={false}>
              Case studies
            </ExternalLinkChip>
            <ExternalLinkChip href="/resume" external={false}>
              Resume
            </ExternalLinkChip>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="node-shell p-5">
          <FileText className="h-6 w-6 text-violet" />
          <p className="mt-4 text-3xl font-black text-text-primary">{publications.length}</p>
          <p className="mt-1 text-sm text-text-muted">publication records</p>
        </div>
        <div className="node-shell p-5">
          <BookOpen className="h-6 w-6 text-cyan" />
          <p className="mt-4 text-3xl font-black text-text-primary">{caseStudies.length}</p>
          <p className="mt-1 text-sm text-text-muted">case study writeups</p>
        </div>
        <div className="node-shell p-5">
          <NotebookTabs className="h-6 w-6 text-green" />
          <p className="mt-4 text-3xl font-black text-text-primary">open</p>
          <p className="mt-1 text-sm text-text-muted">field-note structure</p>
        </div>
      </div>

      <SectionShell title="Resume" eyebrow="current pdf">
        <Link
          href="/resume"
          className="node-shell flex flex-col gap-4 p-5 transition-colors hover:border-cyan/30 hover:bg-cyan/[0.04] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="technical-label">professional document</p>
            <h2 className="mt-2 text-xl font-black text-text-primary">Current resume</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Stable PDF view for neuroscience data infrastructure, multimodal ML, BCI systems, and applied AI work.
            </p>
          </div>
          <FileText className="h-6 w-6 shrink-0 text-cyan" />
        </Link>
      </SectionShell>

      <SectionShell title="Publication Archive" eyebrow="papers">
        {publications.length > 0 ? (
          <div className="grid gap-4">
            {publications.map((publication) => (
              <article key={publication.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="technical-label">{publication.publication?.year ?? 'paper'}</p>
                    <h2 className="mt-2 text-xl font-black text-text-primary">{publication.title}</h2>
                    {publication.publication?.venue && (
                      <p className="mt-2 text-sm italic text-text-muted">{publication.publication.venue}</p>
                    )}
                  </div>
                  <Link href="/publications" className="inline-flex min-h-11 items-center gap-2 text-sm text-violet hover:text-violet-100">
                    View focus archive
                    <Archive className="h-4 w-4" />
                  </Link>
                </div>
                {publication.summary && (
                  <p className="mt-4 text-sm leading-7 text-text-secondary">{publication.summary}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {publication.tags.slice(0, 6).map((tag) => (
                    <TagPill key={tag} color={getTagColor(tag)}>
                      {tag}
                    </TagPill>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Publication archive" copy="Publication data will appear here once records are available." />
        )}
      </SectionShell>

      <SectionShell title="Case Studies" eyebrow="project writeups">
        {caseStudies.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {caseStudies.map((study) => (
              <Link
                key={study.slug}
                href={`/case-studies/${study.slug}`}
                className="rounded-lg border border-white/10 bg-white/[0.035] p-5 transition-colors hover:border-cyan/35 hover:bg-cyan/[0.04]"
              >
                <p className="technical-label">{study.frontmatter.date ?? 'case study'}</p>
                <h2 className="mt-3 text-lg font-black text-text-primary">{study.frontmatter.title}</h2>
                {study.frontmatter.summary && (
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-text-secondary">
                    {study.frontmatter.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Case studies" copy="Long-form project writeups will appear here once curated." />
        )}
      </SectionShell>
    </PageShell>
  );
}
