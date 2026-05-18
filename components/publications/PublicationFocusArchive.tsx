'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, BookOpen, ExternalLink, FileText, Radio, Sparkles, Zap } from 'lucide-react';
import type { NeuralNode } from '@/lib/data/schemas';
import type { OpenAlexPublicationEnhancement } from '@/lib/openalex';
import { TagPill, getTagColor } from '@/components/ui';

type PublicationFocusArchiveProps = {
  publications: NeuralNode[];
  enhancements: Record<string, OpenAlexPublicationEnhancement>;
};

type NodePosition = {
  id: string;
  x: number;
  y: number;
};

function positionFor(index: number, total: number): { x: number; y: number } {
  if (total === 1) return { x: 50, y: 42 };
  if (total === 2) return [{ x: 33, y: 40 }, { x: 67, y: 58 }][index];
  if (total === 3) return [{ x: 20, y: 34 }, { x: 68, y: 24 }, { x: 45, y: 70 }][index];

  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / total);
  const radiusX = 34;
  const radiusY = 28;
  return {
    x: 50 + Math.cos(angle) * radiusX,
    y: 48 + Math.sin(angle) * radiusY,
  };
}

function pathBetween(source: NodePosition, target: NodePosition, index: number): string {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const bend = index % 2 === 0 ? 9 : -9;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const controlX = midX + (-dy / length) * bend;
  const controlY = midY + (dx / length) * bend;

  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function citationTotal(publication: NeuralNode, enhancement?: OpenAlexPublicationEnhancement) {
  return enhancement?.citedByCount ?? publication.publication?.citationCount ?? 0;
}

function maxSparklineValue(enhancement?: OpenAlexPublicationEnhancement) {
  return Math.max(1, ...(enhancement?.citationSparkline ?? []).map((item) => item.count));
}

export function PublicationFocusArchive({ publications, enhancements }: PublicationFocusArchiveProps) {
  const [activeId, setActiveId] = useState(publications[0]?.id ?? '');
  const [focusMode, setFocusMode] = useState(true);

  const activePublication = publications.find((publication) => publication.id === activeId) ?? publications[0];
  const activeEnhancement = activePublication ? enhancements[activePublication.id] : undefined;

  const positions = useMemo<NodePosition[]>(
    () =>
      publications.map((publication, index) => ({
        id: publication.id,
        ...positionFor(index, publications.length),
      })),
    [publications]
  );

  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);

  if (!activePublication) return null;

  return (
    <section className={`publication-focus-shell ${focusMode ? 'publication-focus-shell-active' : ''}`}>
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-violet/80">OpenAlex enriched archive</p>
          <h2 className="mt-2 text-2xl font-black text-text-primary">Publication focus chamber</h2>
        </div>
        <button
          type="button"
          onClick={() => setFocusMode((enabled) => !enabled)}
          className={`signal-button ${focusMode ? 'border-violet/60 bg-violet/15 text-violet-100' : 'border-white/15 bg-white/[0.035] text-text-secondary'}`}
          aria-pressed={focusMode}
        >
          <Radio className="h-4 w-4" />
          Focus mode
        </button>
      </div>

      <div className="hidden min-h-[720px] lg:block">
        <div className="relative h-[720px] overflow-hidden border border-white/10 bg-black/[0.2]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(167,139,250,0.12),transparent_24rem),radial-gradient(circle_at_18%_82%,rgba(102,227,255,0.08),transparent_18rem)]" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="publicationGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {positions.map((source, index) => {
              const target = positions[(index + 1) % positions.length];
              if (!target || source.id === target.id) return null;
              const path = pathBetween(source, target, index);
              const activeEdge = focusMode && (source.id === activeId || target.id === activeId);

              return (
                <g key={`${source.id}-${target.id}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={activeEdge ? 'rgba(220,210,255,0.86)' : 'rgba(167,139,250,0.24)'}
                    strokeWidth={activeEdge ? 0.52 : 0.26}
                    strokeLinecap="round"
                    className={activeEdge ? 'publication-signal-path' : 'publication-signal-path-idle'}
                  />
                  {activeEdge && (
                    <circle r="1.05" fill="#f7fbff" filter="url(#publicationGlow)">
                      <animateMotion dur="1.9s" repeatCount="indefinite" path={path} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {publications.map((publication, index) => {
            const enhancement = enhancements[publication.id];
            const position = positionById.get(publication.id) ?? { x: 50, y: 50 };
            const active = publication.id === activeId;
            const citations = citationTotal(publication, enhancement);

            return (
              <motion.button
                key={publication.id}
                type="button"
                onClick={() => setActiveId(publication.id)}
                onFocus={() => setActiveId(publication.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: focusMode && !active ? 0.72 : 1, scale: active ? 1.03 : 1 }}
                transition={{ delay: index * 0.08 }}
                className={`publication-focus-card absolute w-[21rem] -translate-x-1/2 -translate-y-1/2 p-5 text-left ${active ? 'publication-focus-card-active' : ''}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                aria-label={`Focus ${publication.title}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-violet/85">
                    <FileText className="h-4 w-4" />
                    {publication.publication?.year ?? 'paper'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Activity className="h-3.5 w-3.5 text-cyan" />
                    {citations} cites
                  </span>
                </div>
                <h3 className="text-lg font-black leading-tight text-text-primary">{publication.title}</h3>
                <p className="mt-2 text-sm italic text-text-muted">{enhancement?.primarySource ?? publication.publication?.venue}</p>
                <div className="mt-4 flex items-end gap-1" aria-hidden="true">
                  {(enhancement?.citationSparkline ?? []).slice(-8).map((item) => (
                    <span
                      key={item.year}
                      className="w-4 bg-violet/55 shadow-[0_0_16px_rgba(167,139,250,0.32)]"
                      style={{ height: `${Math.max(7, (item.count / maxSparklineValue(enhancement)) * 42)}px` }}
                    />
                  ))}
                </div>
              </motion.button>
            );
          })}

          <ActivePublicationPanel publication={activePublication} enhancement={activeEnhancement} />
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {publications.map((publication) => (
          <button
            key={publication.id}
            type="button"
            onClick={() => setActiveId(publication.id)}
            className={`publication-focus-card p-5 text-left ${publication.id === activeId ? 'publication-focus-card-active' : ''}`}
          >
            <h3 className="text-lg font-black text-text-primary">{publication.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{publication.publication?.venue}</p>
          </button>
        ))}
        <ActivePublicationPanel publication={activePublication} enhancement={activeEnhancement} />
      </div>
    </section>
  );
}

function ActivePublicationPanel({
  publication,
  enhancement,
}: {
  publication: NeuralNode;
  enhancement?: OpenAlexPublicationEnhancement;
}) {
  const pub = publication.publication;
  const citations = citationTotal(publication, enhancement);
  const abstract = enhancement?.abstract || publication.summary;

  return (
    <motion.aside
      key={publication.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="publication-focus-detail bottom-5 left-5 right-5 p-5 lg:absolute lg:left-auto lg:w-[30rem]"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-cyan/80">active artifact</p>
        <span className="flex items-center gap-2 border border-violet/30 bg-violet/10 px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-violet">
          <Zap className="h-3.5 w-3.5" />
          firing
        </span>
      </div>
      <h3 className="text-2xl font-black leading-tight text-text-primary">{publication.title}</h3>
      {pub?.authors && (
        <p className="mt-3 text-sm leading-6 text-text-secondary">{pub.authors.join(', ')}</p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="citations" value={citations.toString()} />
        <Metric label="refs" value={(enhancement?.referencedWorksCount ?? 0).toString()} />
        <Metric label="year" value={(pub?.year ?? '----').toString()} />
      </div>
      {abstract && <p className="mt-4 line-clamp-5 text-sm leading-6 text-text-secondary">{abstract}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[...(enhancement?.topics ?? []), ...publication.tags].slice(0, 7).map((tag, index) => (
          <TagPill key={`${tag}-${index}`} color={getTagColor(tag)} size="sm">
            {tag}
          </TagPill>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
        {pub?.localPdfPath && (
          <a href={pub.localPdfPath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-amber hover:text-amber-100">
            <FileText className="h-4 w-4" />
            Local PDF
          </a>
        )}
        {pub?.doi && (
          <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-violet hover:text-violet-100">
            DOI <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {pub?.pmid && (
          <a href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan hover:text-cyan-100">
            PubMed <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {enhancement?.openAlexId && (
          <a href={enhancement.openAlexId} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            OpenAlex <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {enhancement?.openAccessUrl && (
          <a href={enhancement.openAccessUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-green hover:text-green-100">
            <BookOpen className="h-4 w-4" />
            Open access
          </a>
        )}
      </div>
      {enhancement?.openAccessStatus && (
        <p className="mt-4 flex items-center gap-2 text-xs text-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-violet" />
          {enhancement.openAccessStatus} access signal from OpenAlex
        </p>
      )}
    </motion.aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/[0.24] p-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-text-primary">{value}</p>
    </div>
  );
}
