'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  FileCode2,
  Github,
  Network,
  RotateCcw,
  Tags,
  Users,
  X,
} from 'lucide-react';
import type { AtlasLeafContentType, AtlasNode } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';

type LeafDetailPanelProps = {
  node: AtlasNode | null;
  relatedNodes: AtlasNode[];
};

type ActionLink = {
  href: string;
  label: string;
  icon: 'github' | 'doi' | 'external';
};

const CONTENT_LABELS: Record<AtlasLeafContentType, string> = {
  project: 'Project neuron',
  publication: 'Publication neuron',
  'case-study': 'Case study neuron',
  'field-note': 'Field note neuron',
  idea: 'Idea neuron',
  photography: 'Photography neuron',
  contact: 'Contact neuron',
  external: 'External neuron',
};

export function LeafDetailPanel({ node, relatedNodes }: LeafDetailPanelProps) {
  const closeDetail = useAtlasStore((state) => state.closeDetail);
  const focusLeaf = useAtlasStore((state) => state.focusLeaf);
  const [showRelated, setShowRelated] = useState(() => node?.contentType === 'project');

  const externalAction = useMemo(() => (node ? externalActionForNode(node) : null), [node]);

  if (!node) return null;

  return (
    <motion.aside
      key={node.id}
      initial={{ opacity: 0, y: 34, scale: 0.97, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 28, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto fixed inset-x-3 bottom-3 z-50 max-h-[86vh] overflow-hidden border border-cyan/20 bg-bg-deep/[0.94] shadow-[0_0_90px_rgba(102,227,255,0.22)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(46rem,calc(100vw-3rem))] lg:bottom-1/2 lg:right-8 lg:max-h-[min(82vh,52rem)] lg:translate-y-1/2"
      role="dialog"
      aria-modal={false}
      aria-labelledby="atlas-leaf-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(102,227,255,0.14),transparent_19rem),radial-gradient(circle_at_100%_20%,rgba(167,139,250,0.11),transparent_20rem)]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan/80 to-transparent" />

      <div className="relative flex max-h-[86vh] flex-col lg:max-h-[min(82vh,52rem)]">
        <header className="border-b border-white/10 px-5 py-4 sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.26em] text-cyan/80">
                {CONTENT_LABELS[node.contentType]} / {node.morphology}
              </p>
              <h2 id="atlas-leaf-title" className="mt-3 text-2xl font-black leading-tight text-text-primary sm:text-4xl">
                {node.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-black/30 text-text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
              aria-label="Close detail"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={node.route} className="signal-button">
              <BookOpen className="h-4 w-4" />
              Open full page
            </Link>
            {externalAction && (
              <a
                href={externalAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="signal-button border-white/15 bg-white/[0.04] text-text-secondary"
              >
                {externalAction.icon === 'github' && <Github className="h-4 w-4" />}
                {externalAction.icon === 'doi' && <FileCode2 className="h-4 w-4" />}
                {externalAction.icon === 'external' && <ArrowUpRight className="h-4 w-4" />}
                {externalAction.label}
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowRelated((visible) => !visible)}
              disabled={relatedNodes.length === 0}
              className="signal-button border-white/15 bg-white/[0.04] text-text-secondary disabled:cursor-not-allowed disabled:opacity-45"
              aria-pressed={showRelated}
            >
              <Network className="h-4 w-4" />
              Related nodes
            </button>
            <button
              type="button"
              onClick={closeDetail}
              className="signal-button border-white/15 bg-white/[0.04] text-text-secondary"
            >
              <RotateCcw className="h-4 w-4" />
              Back to subnetwork
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="border border-white/10 bg-black/[0.35] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-6">
            <p className="max-w-3xl text-lg leading-8 text-text-primary">{node.summary}</p>
            {node.detail?.description && node.detail.description !== node.summary && (
              <p className="mt-5 max-w-3xl text-base leading-8 text-text-secondary">{node.detail.description}</p>
            )}
          </div>

          <ContentBody node={node} />

          <div className="mt-6 flex flex-wrap gap-2">
            {[...node.domains, ...node.tags].slice(0, 12).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 border border-cyan/15 bg-cyan/[0.06] px-2.5 py-1.5 text-xs text-cyan/90"
              >
                <Tags className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>

          {showRelated && relatedNodes.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 border border-white/10 bg-black/[0.28] p-4"
            >
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-text-primary">Related nodes</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {relatedNodes.map((related) => (
                  <button
                    key={related.id}
                    type="button"
                    onClick={() => focusLeaf(related.id, related.parentId)}
                    className="border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-cyan/[0.35] hover:bg-cyan/[0.07] focus:border-cyan/40 focus:outline-none"
                  >
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-cyan/75">
                      {related.contentType}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-text-primary">
                      {related.title}
                    </span>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

function ContentBody({ node }: { node: AtlasNode }) {
  if (node.contentType === 'publication') return <PublicationDetail node={node} />;
  if (node.contentType === 'project') return <ProjectDetail node={node} />;
  if (node.contentType === 'case-study') return <CaseStudyDetail node={node} />;
  if (node.contentType === 'idea') return <IdeaDetail node={node} />;
  if (node.contentType === 'photography' || node.contentType === 'field-note') return <PhotographyDetail node={node} />;
  return <ExternalDetail node={node} />;
}

function ProjectDetail({ node }: { node: AtlasNode }) {
  const highlights = node.detail?.architectureHighlights ?? [];
  const files = node.detail?.representativeFiles ?? [];
  const isCodeExplanation = highlights.length > 0 || files.length > 0;

  return (
    <div className="mt-6 grid gap-4">
      {node.detail?.whyItMatters && <ReadingSection title="Why it matters">{node.detail.whyItMatters}</ReadingSection>}
      {isCodeExplanation && highlights.length > 0 && (
        <BulletSection title="Architecture highlights" items={highlights} />
      )}
      {isCodeExplanation && files.length > 0 && <PillSection title="Representative modules/files" items={files} />}
      {node.detail?.demonstrates && (
        <ReadingSection title="What this demonstrates">{node.detail.demonstrates}</ReadingSection>
      )}
    </div>
  );
}

function PublicationDetail({ node }: { node: AtlasNode }) {
  const pub = node.publication;

  return (
    <div className="mt-6 grid gap-4">
      <div className="grid gap-3 border border-white/10 bg-black/[0.28] p-4 sm:grid-cols-3">
        <MetaItem icon={<Calendar className="h-4 w-4" />} label="Year" value={pub?.year?.toString() ?? 'Curating'} />
        <MetaItem icon={<BookOpen className="h-4 w-4" />} label="Venue" value={pub?.venue ?? 'Curating'} />
        <MetaItem icon={<FileCode2 className="h-4 w-4" />} label="Identifiers" value={identifierText(node)} />
      </div>
      {pub?.authors && pub.authors.length > 0 && (
        <ReadingSection title="Authors" icon={<Users className="h-4 w-4" />}>
          {pub.authors.join(', ')}
        </ReadingSection>
      )}
      <ReadingSection title="My contribution">
        {node.detail?.myContribution ?? 'Contribution details are being curated for this paper.'}
      </ReadingSection>
      <BulletSection title="Readable summary" items={node.detail?.summaryBullets ?? [node.summary]} />
      {node.detail?.paperPdfPath && (
        <section className="overflow-hidden border border-white/10 bg-black/[0.28]">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-text-primary">Paper preview</h3>
          </div>
          <iframe src={node.detail.paperPdfPath} title={`${node.title} PDF`} className="h-[28rem] w-full bg-bg-deep" />
        </section>
      )}
    </div>
  );
}

function CaseStudyDetail({ node }: { node: AtlasNode }) {
  return (
    <div className="mt-6 grid gap-4">
      <ReadingSection title="Case study summary">{node.detail?.description ?? node.summary}</ReadingSection>
      {node.detail?.whyItMatters && <ReadingSection title="Why it matters">{node.detail.whyItMatters}</ReadingSection>}
    </div>
  );
}

function IdeaDetail({ node }: { node: AtlasNode }) {
  return (
    <div className="mt-6 grid gap-4">
      {node.detail?.whyItMatters && <ReadingSection title="Research pull">{node.detail.whyItMatters}</ReadingSection>}
      {node.detail?.demonstrates && <ReadingSection title="What it signals">{node.detail.demonstrates}</ReadingSection>}
    </div>
  );
}

function PhotographyDetail({ node }: { node: AtlasNode }) {
  return (
    <div className="mt-6 grid gap-4">
      <ReadingSection title="Field note">{node.detail?.whyItMatters ?? node.summary}</ReadingSection>
    </div>
  );
}

function ExternalDetail({ node }: { node: AtlasNode }) {
  return (
    <div className="mt-6 grid gap-4">
      <ReadingSection title={node.contentType === 'contact' ? 'Contact signal' : 'External signal'}>
        {node.detail?.whyItMatters ?? node.summary}
      </ReadingSection>
    </div>
  );
}

function ReadingSection({
  title,
  children,
  icon,
}: {
  title: string;
  children: string;
  icon?: ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-black/[0.28] p-4">
      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-text-primary">
        {icon}
        {title}
      </h3>
      <p className="mt-3 text-base leading-8 text-text-secondary">{children}</p>
    </section>
  );
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="border border-white/10 bg-black/[0.28] p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-text-primary">{title}</h3>
      <ul className="mt-3 space-y-3 text-base leading-7 text-text-secondary">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_12px_rgba(102,227,255,0.7)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PillSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="border border-white/10 bg-black/[0.28] p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-text-primary">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="border border-violet/20 bg-violet/10 px-2.5 py-1.5 font-mono text-xs text-violet-100">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function MetaItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-text-primary">{value}</p>
    </div>
  );
}

function externalActionForNode(node: AtlasNode): ActionLink | null {
  if (node.github?.url) {
    return {
      href: node.github.url,
      label: 'Open GitHub',
      icon: 'github',
    };
  }
  if (node.publication?.doi) {
    return {
      href: `https://doi.org/${node.publication.doi}`,
      label: 'Open DOI',
      icon: 'doi',
    };
  }
  if (node.externalUrl) {
    return {
      href: node.externalUrl,
      label: node.contentType === 'contact' ? 'Open contact' : 'Open external',
      icon: 'external',
    };
  }

  return null;
}

function identifierText(node: AtlasNode) {
  const identifiers = [
    node.publication?.doi ? `DOI ${node.publication.doi}` : null,
    node.publication?.pmid ? `PMID ${node.publication.pmid}` : null,
    node.publication?.pmcid ? `PMCID ${node.publication.pmcid}` : null,
  ].filter(Boolean);

  return identifiers.length > 0 ? identifiers.join(' / ') : 'Curating';
}
