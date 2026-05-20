import type { Metadata } from 'next';
import Link from 'next/link';
import { Code2, ExternalLink, GitBranch, Github, Star } from 'lucide-react';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema, type NeuralNode } from '@/lib/data/schemas';
import { codeSystems } from '@/src/data/codeSystems';
import { BackToAtlasButton, ExternalLinkChip, PageHeader, PageShell, SectionShell } from '@/components/portfolio/PageShell';
import { TagPill, getTagColor } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Code Systems',
  description:
    'GitHub repositories and code systems by Sidharth Hulyalkar across neural data infrastructure, BCI middleware, multimodal ML, and applied AI.',
  alternates: {
    canonical: '/code',
  },
  openGraph: {
    title: 'Code Systems | Sid's Neural Net',
    description:
      'A portfolio view of code systems spanning neuroscience data infrastructure, BCI, multimodal ML, and applied AI.',
    url: '/code',
  },
};

function byImportance(a: NeuralNode, b: NeuralNode) {
  return (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance);
}

function CodeSystemCard({ system }: { system: (typeof codeSystems)[number] }) {
  return (
    <article className="node-shell flex h-full flex-col p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan/25 bg-cyan/10 text-cyan">
          <Code2 className="h-5 w-5" />
        </span>
        <p className="technical-label">code system</p>
      </div>
      <h2 className="text-xl font-black text-text-primary">{system.title}</h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-text-secondary">{system.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {system.tags.map((tag) => (
          <TagPill key={tag} color={getTagColor(tag)} size="sm">
            {tag}
          </TagPill>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {system.route && (
          <Link href={system.route} className="inline-flex min-h-11 items-center gap-2 text-sm text-cyan hover:text-cyan-100">
            Build detail
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        {system.repo && (
          <a
            href={system.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            GitHub
            <Github className="h-4 w-4" />
          </a>
        )}
      </div>
    </article>
  );
}

function RepositoryCard({ project }: { project: NeuralNode }) {
  const href = project.github?.url ?? project.sourceUrl;
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/projects/${project.slug}`} className="font-semibold text-text-primary hover:text-cyan">
            {project.title}
          </Link>
          {project.github?.language && (
            <p className="mt-1 text-xs text-text-muted">{project.github.language}</p>
          )}
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-text-muted hover:bg-white/5 hover:text-cyan"
            aria-label={`Open ${project.title} on GitHub`}
          >
            <Github className="h-4 w-4" />
          </a>
        )}
      </div>
      {project.summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary">{project.summary}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(project.github?.stars ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber">
            <Star className="h-3.5 w-3.5" />
            {project.github?.stars}
          </span>
        )}
        {project.tags.slice(0, 3).map((tag) => (
          <TagPill key={tag} color={getTagColor(tag)} size="sm">
            {tag}
          </TagPill>
        ))}
      </div>
    </article>
  );
}

export default function CodePage() {
  const graph = NeuralGraphSchema.parse(graphData);
  const repositories = graph.nodes
    .filter((node) => node.type === 'project' && (node.github?.url || node.sourceUrl?.includes('github.com')))
    .sort(byImportance);
  const featuredRepositories = repositories.slice(0, 12);

  return (
    <PageShell>
      <PageHeader
        eyebrow="github"
        title="code systems"
        actions={
          <>
            <ExternalLinkChip href="https://github.com/sidhulyalkar">GitHub profile</ExternalLinkChip>
          </>
        }
      />

      <SectionShell title="Curated Code Systems" eyebrow="systems">
        <div className="grid gap-4 md:grid-cols-2">
          {codeSystems.map((system) => (
            <CodeSystemCard key={system.title} system={system} />
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Repository Signals" eyebrow="github">
        <div className="mb-4 flex items-center gap-3 text-sm text-text-muted">
          <GitBranch className="h-4 w-4 text-cyan" />
          Sorted by portfolio importance, with project detail pages kept as the internal source of context.
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredRepositories.map((project) => (
            <RepositoryCard key={project.id} project={project} />
          ))}
        </div>
      </SectionShell>
    </PageShell>
  );
}
