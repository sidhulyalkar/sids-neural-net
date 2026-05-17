'use client';

import Link from 'next/link';
import { ExternalLink, Github, Star, GitFork } from 'lucide-react';
import { NeuralNode } from '@/lib/data/schemas';
import { TagPill, getTagColor } from '@/components/ui';

interface ProjectCardProps {
  project: NeuralNode;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const importance = project.computedImportance ?? project.importance;

  return (
    <div className="glass-card group hover:border-cyan/30 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/projects/${project.slug}`}
            className="block"
          >
            <h3 className="text-lg font-semibold text-text-primary group-hover:text-cyan transition-colors truncate">
              {project.title}
            </h3>
          </Link>
          {project.domains.length > 0 && (
            <p className="text-sm text-text-muted mt-0.5 truncate">
              {project.domains[0]}
            </p>
          )}
        </div>

        {/* Status badge */}
        <div
          className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
            project.status === 'active'
              ? 'bg-green/20 text-green'
              : project.status === 'complete'
                ? 'bg-cyan/20 text-cyan'
                : project.status === 'experimental'
                  ? 'bg-amber/20 text-amber'
                  : 'bg-text-muted/20 text-text-muted'
          }`}
        >
          {project.status}
        </div>
      </div>

      {/* Summary */}
      {project.summary && (
        <p className="mt-3 text-sm text-text-secondary line-clamp-2">
          {project.summary}
        </p>
      )}

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.tags.slice(0, 5).map((tag) => (
            <TagPill key={tag} color={getTagColor(tag)} size="sm">
              {tag}
            </TagPill>
          ))}
          {project.tags.length > 5 && (
            <span className="text-xs text-text-muted self-center">
              +{project.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Footer with GitHub stats and importance */}
      <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
        {/* GitHub stats */}
        {project.github && (
          <div className="flex items-center gap-3 text-xs text-text-muted">
            {(project.github.stars ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5" />
                {project.github.stars}
              </span>
            )}
            {(project.github.forks ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5" />
                {project.github.forks}
              </span>
            )}
            {project.github.language && (
              <span className="text-text-secondary">{project.github.language}</span>
            )}
          </div>
        )}

        {!project.github && (
          <div className="text-xs text-text-muted">
            {project.source === 'manual' && 'Curated'}
          </div>
        )}

        {/* Importance indicator */}
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-bg-deep rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan/50"
              style={{ width: `${importance}%` }}
            />
          </div>

          {/* Links */}
          <div className="flex items-center gap-1">
            {project.github?.url && (
              <a
                href={project.github.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-text-muted hover:text-cyan transition-colors"
                title="View on GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
            )}
            {project.sourceUrl && !project.github && (
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-text-muted hover:text-cyan transition-colors"
                title="View source"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
