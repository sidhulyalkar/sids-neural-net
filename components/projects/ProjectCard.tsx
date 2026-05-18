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
    <div className="comic-panel group flex min-h-[260px] flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan/[0.35] hover:bg-cyan/[0.045]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/projects/${project.slug}`}
            className="block"
          >
            <h3 className="text-xl font-black text-text-primary transition-colors group-hover:text-cyan">
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
          className={`shrink-0 border px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${
            project.status === 'active'
              ? 'border-green/30 bg-green/10 text-green'
              : project.status === 'complete'
                ? 'border-cyan/30 bg-cyan/10 text-cyan'
                : project.status === 'experimental'
                  ? 'border-amber/30 bg-amber/10 text-amber'
                  : 'border-white/10 bg-text-muted/10 text-text-muted'
          }`}
        >
          {project.status}
        </div>
      </div>

      {/* Summary */}
      {project.summary && (
        <p className="mt-4 text-sm text-text-secondary line-clamp-3">
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
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
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
          <div className="h-1.5 w-12 overflow-hidden bg-bg-deep">
            <div
              className="h-full bg-cyan/50"
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
