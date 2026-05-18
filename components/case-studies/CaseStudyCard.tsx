'use client';

import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';
import { CaseStudyFrontmatter } from '@/lib/content/load-case-studies';
import { TagPill, getTagColor } from '@/components/ui';

interface CaseStudyCardProps {
  caseStudy: {
    frontmatter: CaseStudyFrontmatter;
    slug: string;
  };
}

export function CaseStudyCard({ caseStudy }: CaseStudyCardProps) {
  const { frontmatter, slug } = caseStudy;

  return (
    <Link href={`/case-studies/${slug}`} className="block group">
      <article className="node-shell flex h-full flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan/30 hover:bg-cyan/[0.04]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            <time dateTime={frontmatter.date}>
              {new Date(frontmatter.date).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </time>
          </div>
          {frontmatter.featured && (
            <span className="border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber">
              Featured
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 text-2xl font-black tracking-tight text-text-primary transition-colors group-hover:text-cyan">
          {frontmatter.title}
        </h3>

        {/* Summary */}
        <p className="text-text-secondary text-sm line-clamp-3 mb-4 flex-1">
          {frontmatter.summary}
        </p>

        {/* Domains */}
        {frontmatter.domains.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {frontmatter.domains.map((domain) => (
                <span
                  key={domain}
                  className="border border-violet/20 bg-violet/10 px-2 py-0.5 text-xs text-violet"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {frontmatter.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {frontmatter.tags.slice(0, 4).map((tag) => (
              <TagPill key={tag} color={getTagColor(tag)} size="sm">
                {tag}
              </TagPill>
            ))}
          </div>
        )}

        {/* Read more */}
        <div className="flex items-center gap-2 text-sm text-cyan group-hover:gap-3 transition-all">
          Open project brief
          <ArrowRight className="w-4 h-4" />
        </div>
      </article>
    </Link>
  );
}
