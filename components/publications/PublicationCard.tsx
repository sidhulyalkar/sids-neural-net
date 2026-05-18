'use client';

import { ExternalLink, FileText, Users } from 'lucide-react';
import { NeuralNode } from '@/lib/data/schemas';
import { TagPill, getTagColor } from '@/components/ui';

interface PublicationCardProps {
  publication: NeuralNode;
}

export function PublicationCard({ publication }: PublicationCardProps) {
  const pub = publication.publication;

  return (
    <div className="comic-panel group p-5 transition-all duration-300 hover:border-violet/30">
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-violet/10 rounded-md">
          <FileText className="w-4 h-4 text-violet" />
        </div>
        <span className="text-xs text-violet font-medium">
          Publication
        </span>
        {pub?.year && (
          <span className="text-xs text-text-muted ml-auto">{pub.year}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-text-primary group-hover:text-violet transition-colors">
        {publication.title}
      </h3>

      {/* Authors */}
      {pub?.authors && pub.authors.length > 0 && (
        <div className="mt-2 flex items-start gap-2">
          <Users className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary line-clamp-2">
            {pub.authors.join(', ')}
          </p>
        </div>
      )}

      {/* Venue */}
      {pub?.venue && (
        <p className="mt-2 text-sm text-text-muted italic">
          {pub.venue}
        </p>
      )}

      {/* Summary */}
      {publication.summary && (
        <p className="mt-3 text-sm text-text-secondary line-clamp-2">
          {publication.summary}
        </p>
      )}

      {/* Tags */}
      {publication.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {publication.tags.slice(0, 4).map((tag) => (
            <TagPill key={tag} color={getTagColor(tag)} size="sm">
              {tag}
            </TagPill>
          ))}
        </div>
      )}

      {/* Footer with links */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {pub?.citationCount !== undefined && pub.citationCount > 0 && (
            <span>{pub.citationCount} citations</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pub?.localPdfPath && (
            <a
              href={pub.localPdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber hover:underline"
            >
              PDF
              <FileText className="w-3 h-3" />
            </a>
          )}
          {pub?.doi && (
            <a
              href={`https://doi.org/${pub.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet hover:underline"
            >
              DOI
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {pub?.pmid && (
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
            >
              PubMed
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
