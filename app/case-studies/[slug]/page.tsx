import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getCaseStudyBySlug, getCaseStudySlugs } from '@/lib/content/load-case-studies';
import { TagPill, getTagColor } from '@/components/ui';

interface CaseStudyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = getCaseStudyBySlug(slug);

  if (!caseStudy) {
    return {
      title: 'Case Study Not Found',
    };
  }

  return {
    title: caseStudy.frontmatter.title,
    description: caseStudy.frontmatter.summary,
  };
}

export async function generateStaticParams() {
  const slugs = getCaseStudySlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const caseStudy = getCaseStudyBySlug(slug);

  if (!caseStudy) {
    notFound();
  }

  const { frontmatter, content } = caseStudy;

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/case-studies"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-cyan transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Case Studies
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium text-cyan uppercase tracking-wider">Case Study</span>
            {frontmatter.featured && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber/20 text-amber rounded-full">
                Featured
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold text-text-primary">{frontmatter.title}</h1>
          <p className="mt-4 text-lg text-text-secondary">{frontmatter.summary}</p>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <time dateTime={frontmatter.date}>
                {new Date(frontmatter.date).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            </div>
          </div>

          {/* Domains */}
          {frontmatter.domains.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {frontmatter.domains.map((domain) => (
                <span
                  key={domain}
                  className="px-3 py-1 text-sm bg-violet/10 text-violet border border-violet/20 rounded-full"
                >
                  {domain}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {frontmatter.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {frontmatter.tags.map((tag) => (
                <TagPill key={tag} color={getTagColor(tag)}>
                  {tag}
                </TagPill>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <article className="prose-neural">
          <MDXRemote source={content} />
        </article>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border-subtle">
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 text-sm text-cyan hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            View all case studies
          </Link>
        </div>
      </div>
    </div>
  );
}
