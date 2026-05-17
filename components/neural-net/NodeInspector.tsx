'use client';

import { X, ExternalLink, Github, Calendar, Tag, Layers } from 'lucide-react';
import { NeuralNode } from '@/lib/data/schemas';
import { TagPill } from '@/components/ui';
import Link from 'next/link';

interface NodeInspectorProps {
  node: NeuralNode | null;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  project: 'cyan',
  publication: 'violet',
  role: 'amber',
  organization: 'green',
  skill: 'rose',
  technology: 'cyan',
  concept: 'violet',
  'case-study': 'amber',
  'field-note': 'green',
  'learning-trail': 'rose',
  'personal-interest': 'rose',
  milestone: 'amber',
};

export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  if (!node) return null;

  const importance = node.computedImportance ?? node.importance;
  const color = TYPE_COLORS[node.type] || 'cyan';

  const getDetailUrl = () => {
    switch (node.type) {
      case 'project':
        return `/projects/${node.slug}`;
      case 'publication':
        return node.publication?.doi
          ? `https://doi.org/${node.publication.doi}`
          : `/publications`;
      case 'case-study':
        return `/case-studies/${node.slug}`;
      default:
        return null;
    }
  };

  const detailUrl = getDetailUrl();

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-panel border-l border-border-subtle shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: `var(--${color})` }}
          />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {node.type.replace('-', ' ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-deep transition-colors"
        >
          <X className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
        {/* Title */}
        <h2 className="text-xl font-bold text-text-primary mb-2">{node.title}</h2>

        {/* Summary */}
        {node.summary && (
          <p className="text-text-secondary text-sm mb-4">{node.summary}</p>
        )}

        {/* Importance meter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Importance</span>
            <span className="text-xs text-text-secondary">{importance}</span>
          </div>
          <div className="h-1.5 bg-bg-deep rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${importance}%`,
                backgroundColor: `var(--${color})`,
              }}
            />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-text-muted">Status:</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              node.status === 'active'
                ? 'bg-green/20 text-green'
                : node.status === 'complete'
                  ? 'bg-cyan/20 text-cyan'
                  : 'bg-text-muted/20 text-text-muted'
            }`}
          >
            {node.status}
          </span>
        </div>

        {/* Dates */}
        {(node.startDate || node.endDate) && (
          <div className="flex items-center gap-2 mb-4 text-sm text-text-secondary">
            <Calendar className="w-4 h-4 text-text-muted" />
            <span>
              {node.startDate}
              {node.endDate && node.endDate !== node.startDate && ` - ${node.endDate}`}
            </span>
          </div>
        )}

        {/* Domains */}
        {node.domains.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted">Domains</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {node.domains.map((domain) => (
                <span
                  key={domain}
                  className="text-xs bg-violet/10 text-violet px-2 py-0.5 rounded-full"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted">Tags</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {node.tags.slice(0, 10).map((tag) => (
                <TagPill key={tag} size="sm">{tag}</TagPill>
              ))}
              {node.tags.length > 10 && (
                <span className="text-xs text-text-muted">
                  +{node.tags.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* GitHub info */}
        {node.github && (
          <div className="mb-4 p-3 bg-bg-deep rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Github className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted">GitHub</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>{node.github.stars} stars</span>
              <span>{node.github.forks} forks</span>
              {node.github.language && <span>{node.github.language}</span>}
            </div>
            <a
              href={node.github.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-cyan hover:underline"
            >
              View on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Publication info */}
        {node.publication && (
          <div className="mb-4 p-3 bg-bg-deep rounded-lg">
            <div className="text-xs text-text-muted mb-2">Publication</div>
            <p className="text-sm text-text-secondary mb-1">
              {node.publication.venue} ({node.publication.year})
            </p>
            {node.publication.authors && (
              <p className="text-xs text-text-muted mb-2">
                {node.publication.authors.join(', ')}
              </p>
            )}
            {node.publication.doi && (
              <a
                href={`https://doi.org/${node.publication.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
              >
                View Publication
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-border-subtle">
          {detailUrl && (
            <Link
              href={detailUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan/10 hover:bg-cyan/20 text-cyan rounded-lg transition-colors"
            >
              View Details
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
          {node.sourceUrl && !detailUrl && (
            <a
              href={node.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan/10 hover:bg-cyan/20 text-cyan rounded-lg transition-colors"
            >
              View Source
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
