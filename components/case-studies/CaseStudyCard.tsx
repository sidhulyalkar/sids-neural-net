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
      <article className="glass-card hover:border-cyan/30 transition-all duration-300 h-full flex flex-col">
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
            <span className="px-2 py-0.5 text-xs font-medium bg-amber/20 text-amber rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-text-primary group-hover:text-cyan transition-colors mb-2">
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
                  className="text-xs text-violet bg-violet/10 px-2 py-0.5 rounded-full"
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
          Read case study
          <ArrowRight className="w-4 h-4" />
        </div>
      </article>
    </Link>
  );
}
