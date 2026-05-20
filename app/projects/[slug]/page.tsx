import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Github, Calendar, Tag, Layers, Star, GitFork } from 'lucide-react';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import {
  filterProfessionalProjects,
  isProfessionalProject,
} from '@/lib/graph/professional-projects';
import { TagPill, getTagColor } from '@/components/ui';

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const graph = NeuralGraphSchema.parse(graphData);
  const project = graph.nodes.find((n) => n.slug === slug && isProfessionalProject(n));

  if (!project) {
    return {
      title: 'Project Not Found',
    };
  }

  return {
    title: project.title,
    description: project.summary || `Details about the ${project.title} project.`,
    alternates: {
      canonical: `/projects/${project.slug}`,
    },
    openGraph: {
      title: `${project.title} | Sid Neural Net`,
      description: project.summary || `Details about the ${project.title} project.`,
      url: `/projects/${project.slug}`,
    },
  };
}

export async function generateStaticParams() {
  const graph = NeuralGraphSchema.parse(graphData);
  const projects = filterProfessionalProjects(graph.nodes);
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const graph = NeuralGraphSchema.parse(graphData);
  const project = graph.nodes.find((n) => n.slug === slug && isProfessionalProject(n));

  if (!project) {
    notFound();
  }

  const importance = project.computedImportance ?? project.importance;
  const projectSlug = project.slug;

  // Generated graph edges store node slugs, so keep the lookup slug-based.
  const relatedNodeSlugs = new Set<string>();
  graph.edges.forEach((edge) => {
    if (edge.source === projectSlug) relatedNodeSlugs.add(edge.target);
    if (edge.target === projectSlug) relatedNodeSlugs.add(edge.source);
  });
  const relatedNodes = graph.nodes
    .filter((n) => relatedNodeSlugs.has(n.slug) && n.slug !== projectSlug)
    .filter((n) => n.type !== 'project' || isProfessionalProject(n))
    .slice(0, 6);

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-cyan transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Builds
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium text-cyan uppercase tracking-wider">Build</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                project.status === 'active'
                  ? 'bg-green/20 text-green'
                  : project.status === 'complete'
                    ? 'bg-cyan/20 text-cyan'
                    : 'bg-text-muted/20 text-text-muted'
              }`}
            >
              {project.status}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-text-primary">{project.title}</h1>

          {/* Importance bar */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-text-muted">Importance</span>
            <div className="flex-1 max-w-xs h-1.5 bg-bg-panel rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan"
                style={{ width: `${importance}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary">{importance}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="glass-card mb-8 p-6">
          {/* Summary */}
          {project.summary && (
            <p className="text-lg text-text-secondary leading-relaxed">
              {project.summary}
            </p>
          )}

          {/* Domains */}
          {project.domains.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-muted">Domains</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.domains.map((domain) => (
                  <span
                    key={domain}
                    className="px-3 py-1 text-sm bg-violet/10 text-violet border border-violet/20 rounded-full"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-muted">Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <TagPill key={tag} color={getTagColor(tag)}>
                    {tag}
                  </TagPill>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          {(project.startDate || project.updatedAt) && (
            <div className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
              <Calendar className="w-4 h-4 text-text-muted" />
              {project.startDate && <span>Started {project.startDate}</span>}
              {project.updatedAt && (
                <span className="text-text-muted">
                  • Updated {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* GitHub info */}
        {project.github && (
          <div className="glass-card mb-8 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Github className="w-5 h-5 text-text-muted" />
              <h2 className="text-lg font-semibold text-text-primary">GitHub Repository</h2>
            </div>

            <div className="flex items-center gap-6 text-sm text-text-secondary mb-4">
              {(project.github.stars ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber" />
                  {project.github.stars} stars
                </span>
              )}
              {(project.github.forks ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <GitFork className="w-4 h-4" />
                  {project.github.forks} forks
                </span>
              )}
              {project.github.language && (
                <span>Primary language: {project.github.language}</span>
              )}
            </div>

            {project.github.description && (
              <p className="text-sm text-text-muted mb-4">{project.github.description}</p>
            )}

            <a
              href={project.github.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan/10 hover:bg-cyan/20 text-cyan rounded-lg transition-colors"
            >
              View on GitHub
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {!project.github && project.sourceUrl && (
          <div className="glass-card mb-8 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ExternalLink className="w-5 h-5 text-text-muted" />
              <h2 className="text-lg font-semibold text-text-primary">Build Link</h2>
            </div>
            <a
              href={project.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan/10 hover:bg-cyan/20 text-cyan rounded-lg transition-colors"
            >
              Open project repository
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Related nodes */}
        {relatedNodes.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Related</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedNodes.map((node) => (
                <Link
                  key={node.id}
                  href={node.type === 'project' ? `/projects/${node.slug}` : `/neural-net?focus=${node.slug}`}
                  className="p-3 bg-bg-deep rounded-lg hover:bg-bg-panel transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-text-muted capitalize">{node.type}</span>
                  </div>
                  <h3 className="text-sm font-medium text-text-primary truncate">{node.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* View in Neural Net */}
        <div className="mt-8 text-center">
          <Link
            href={`/neural-net?focus=${project.slug}`}
            className="inline-flex items-center gap-2 text-sm text-cyan hover:underline"
          >
            View in Neural Net
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
