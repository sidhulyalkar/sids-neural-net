'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ExternalLink, X } from 'lucide-react';
import { DendritePath } from './DendritePath';
import { NeuralBackground } from './NeuralBackground';
import { NeuralNodeButton } from './NeuralNode';
import { SignalPropagationOverlay } from './SignalPropagationOverlay';
import {
  atlasCategories,
  getAtlasCategory,
  getAtlasStats,
  getRelatedAtlasLeaves,
  getSubnetwork,
  nodeTypeColors,
  rootCategoryEdges,
} from './registry';
import type { AtlasCategoryId, NeuralAtlasNode } from './registry';

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function NeuralGraphHome() {
  const reducedMotion = useReducedMotionPreference();
  const stats = useMemo(() => getAtlasStats(), []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<AtlasCategoryId | null>(null);
  const [selectedLeaf, setSelectedLeaf] = useState<NeuralAtlasNode | null>(null);
  const [signalNode, setSignalNode] = useState<NeuralAtlasNode | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const signalTimeout = useRef<number | null>(null);

  const selectedCategory = getAtlasCategory(activeCategoryId);
  const subnetwork = useMemo(
    () =>
      activeCategoryId
        ? getSubnetwork(activeCategoryId)
        : { nodes: atlasCategories, edges: rootCategoryEdges, leaves: [] as NeuralAtlasNode[] },
    [activeCategoryId]
  );

  const nodeById = useMemo(
    () => new Map(subnetwork.nodes.map((node) => [node.id, node])),
    [subnetwork.nodes]
  );

  const activeNode =
    nodeById.get(hoveredId ?? selectedLeaf?.id ?? activeCategoryId ?? 'about') ??
    selectedCategory ??
    atlasCategories[0];

  const relatedIds = useMemo(() => {
    const focus = hoveredId ?? selectedLeaf?.id ?? activeCategoryId;
    if (!focus) return new Set<string>();
    return new Set(
      subnetwork.edges
        .filter((edge) => edge.from === focus || edge.to === focus)
        .flatMap((edge) => [edge.from, edge.to])
    );
  }, [activeCategoryId, hoveredId, selectedLeaf?.id, subnetwork.edges]);

  const relatedLeaves = useMemo(
    () => (selectedLeaf ? getRelatedAtlasLeaves(selectedLeaf, subnetwork.leaves) : []),
    [selectedLeaf, subnetwork.leaves]
  );

  useEffect(() => {
    return () => {
      if (signalTimeout.current) window.clearTimeout(signalTimeout.current);
    };
  }, []);

  const pulseSignal = (node: NeuralAtlasNode) => {
    if (signalTimeout.current) window.clearTimeout(signalTimeout.current);

    if (reducedMotion) {
      setSignalNode(null);
      return;
    }

    setSignalNode(node);
    signalTimeout.current = window.setTimeout(() => setSignalNode(null), 1850);
  };

  const openNode = (node: NeuralAtlasNode) => {
    if (node.kind === 'category') {
      setActiveCategoryId(node.id as AtlasCategoryId);
      setSelectedLeaf(null);
      pulseSignal(node);
      return;
    }

    setActiveCategoryId(node.categoryId ?? activeCategoryId);
    setSelectedLeaf(node);
    pulseSignal(node);
  };

  const resetAtlas = () => {
    setActiveCategoryId(null);
    setSelectedLeaf(null);
    setHoveredId(null);
  };

  const focusNode = selectedLeaf ?? selectedCategory;
  const cameraScale = selectedLeaf ? 1.62 : selectedCategory ? 1.36 : 1;
  const cameraX = focusNode ? `${50 - focusNode.x}%` : '0%';
  const cameraY = focusNode ? `${50 - focusNode.y}%` : '0%';

  return (
    <section className="relative min-h-screen overflow-hidden bg-bg-deep text-text-primary">
      <NeuralBackground />

      <main className="relative z-10 min-h-screen px-4 pb-8 pt-10 sm:px-6">
        <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl gap-5 lg:grid-cols-[21rem_1fr_22rem]">
          <AtlasControlPanel
            stats={stats}
            activeCategoryId={activeCategoryId}
            onReset={resetAtlas}
            onOpenCategory={(id) => {
              const category = atlasCategories.find((node) => node.id === id);
              if (category) openNode(category);
            }}
            onOpenPalette={() => setPaletteOpen(true)}
          />

          <section className="relative min-h-[650px] overflow-hidden border border-white/10 bg-black/[0.2] backdrop-blur-sm atlas-stage">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.06),transparent_18rem)]" />
            <motion.div
              className="absolute inset-0"
              animate={{ scale: cameraScale, x: cameraX, y: cameraY }}
              transition={{ duration: reducedMotion ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <svg
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <filter id="atlasGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {subnetwork.edges.map((edge, index) => {
                  const source = nodeById.get(edge.from);
                  const target = nodeById.get(edge.to);
                  if (!source || !target) return null;
                  const isLeafEdge = source.kind === 'leaf' || target.kind === 'leaf';
                  return (
                    <g key={`${edge.from}-${edge.to}-${index}`} opacity={isLeafEdge && !activeCategoryId ? 0 : 1}>
                      <DendritePath
                        edge={edge}
                        source={source}
                        target={target}
                        index={index}
                        activeId={activeNode.id}
                        hoveredId={hoveredId}
                        selectedId={signalNode?.id ?? selectedLeaf?.id ?? null}
                      />
                    </g>
                  );
                })}
              </svg>

              {subnetwork.nodes.map((node, index) => (
                <NeuralNodeButton
                  key={node.id}
                  node={node}
                  index={index}
                  isActive={activeNode.id === node.id}
                  isHovered={hoveredId === node.id}
                  isDimmed={hoveredId !== null && !relatedIds.has(node.id) && hoveredId !== node.id}
                  isRevealed={node.kind === 'category' || Boolean(activeCategoryId)}
                  onHover={setHoveredId}
                  onFocus={(id) => {
                    const next = nodeById.get(id);
                    if (next?.kind === 'category') setActiveCategoryId(next.id as AtlasCategoryId);
                  }}
                  onOpen={openNode}
                />
              ))}
            </motion.div>

            <div className="pointer-events-none absolute left-4 top-4 z-30 flex flex-wrap gap-2">
              <span className="border border-white/10 bg-black/[0.34] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-cyan/80 backdrop-blur-md">
                atlas layer
              </span>
              <span className="border border-white/10 bg-black/[0.34] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-text-muted backdrop-blur-md">
                {activeCategoryId ? `${subnetwork.leaves.length} local neurons` : `${atlasCategories.length} category somas`}
              </span>
            </div>

            {activeCategoryId && (
              <button
                type="button"
                onClick={resetAtlas}
                className="absolute bottom-4 left-4 z-30 inline-flex items-center gap-2 border border-white/10 bg-black/[0.36] px-3 py-2 text-sm text-text-secondary backdrop-blur-md transition-colors hover:text-cyan"
              >
                <ArrowLeft className="h-4 w-4" />
                Cortex overview
              </button>
            )}
          </section>

          <AtlasReadout
            node={activeNode}
            leaves={subnetwork.leaves}
            activeCategoryId={activeCategoryId}
            onOpen={openNode}
          />
        </div>
      </main>

      <AnimatePresence>{signalNode && <SignalPropagationOverlay node={signalNode} />}</AnimatePresence>
      <AnimatePresence>
        {selectedLeaf && (
          <AtlasLeafDetail
            leaf={selectedLeaf}
            relatedLeaves={relatedLeaves}
            onClose={() => setSelectedLeaf(null)}
            onOpen={openNode}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {paletteOpen && (
          <AtlasPalette
            onClose={() => setPaletteOpen(false)}
            onOpen={(node) => {
              setPaletteOpen(false);
              openNode(node);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function AtlasControlPanel({
  stats,
  activeCategoryId,
  onReset,
  onOpenCategory,
  onOpenPalette,
}: {
  stats: ReturnType<typeof getAtlasStats>;
  activeCategoryId: AtlasCategoryId | null;
  onReset: () => void;
  onOpenCategory: (id: AtlasCategoryId) => void;
  onOpenPalette: () => void;
}) {
  return (
    <aside className="relative z-20 self-start border border-white/10 bg-black/[0.28] p-4 backdrop-blur-xl lg:sticky lg:top-24">
      <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan/75">neural graph / life & work</p>
      <h1 className="mt-4 text-4xl font-black leading-[0.95] text-text-primary">
        Navigate the living tissue map.
      </h1>
      <p className="mt-4 text-sm leading-6 text-text-secondary">
        A curated spatial interface over {stats.nodes} generated nodes and {stats.edges} graph connections,
        tuned for research, code, publications, field notes, and contact paths.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatPill value={stats.projects} label="builds" />
        <StatPill value={stats.publications} label="papers" />
        <StatPill value={stats.edges} label="links" />
      </div>

      <div className="mt-5 grid gap-2">
        {atlasCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onOpenCategory(category.id as AtlasCategoryId)}
            className={`group flex items-center justify-between border px-3 py-2 text-left transition-colors ${
              activeCategoryId === category.id
                ? 'border-cyan/40 bg-cyan/[0.1] text-cyan'
                : 'border-white/10 bg-white/[0.035] text-text-secondary hover:border-white/20 hover:text-text-primary'
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{category.label}</span>
              <span className="mt-0.5 block truncate font-mono text-[0.58rem] uppercase tracking-[0.18em] text-text-muted">
                {category.annotation}
              </span>
            </span>
            <span
              className="ml-3 h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: nodeTypeColors[category.type],
                boxShadow: `0 0 16px ${nodeTypeColors[category.type]}`,
              }}
            />
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onReset} className="signal-button flex-1 border-white/15 bg-white/[0.035] text-text-secondary">
          Overview
        </button>
        <button type="button" onClick={onOpenPalette} className="signal-button flex-1">
          Find node
        </button>
      </div>
    </aside>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-2">
      <div className="text-lg font-black text-cyan">{value}</div>
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-text-muted">{label}</div>
    </div>
  );
}

function AtlasReadout({
  node,
  leaves,
  activeCategoryId,
  onOpen,
}: {
  node: NeuralAtlasNode;
  leaves: NeuralAtlasNode[];
  activeCategoryId: AtlasCategoryId | null;
  onOpen: (node: NeuralAtlasNode) => void;
}) {
  const color = nodeTypeColors[node.type];

  return (
    <aside className="relative z-20 self-end border border-white/10 bg-black/[0.32] p-4 backdrop-blur-xl lg:sticky lg:bottom-8">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.25em]" style={{ color }}>
        {node.annotation}
      </p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-text-primary">{node.label}</h2>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{node.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen(node)} className="signal-button">
          {node.kind === 'leaf' ? 'Inspect neuron' : 'Enter subnetwork'} <ArrowUpRight className="h-4 w-4" />
        </button>
        <Link href={node.route} className="signal-button border-white/15 bg-white/[0.035] text-text-secondary">
          Open route
        </Link>
      </div>

      {activeCategoryId && leaves.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">local neurons</p>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
            {leaves.map((leaf) => (
              <button
                key={leaf.id}
                type="button"
                onClick={() => onOpen(leaf)}
                className="group border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-cyan/30 hover:bg-cyan/[0.055]"
              >
                <span className="block text-sm font-semibold text-text-primary group-hover:text-cyan">{leaf.label}</span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">{leaf.annotation}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function AtlasLeafDetail({
  leaf,
  relatedLeaves,
  onClose,
  onOpen,
}: {
  leaf: NeuralAtlasNode;
  relatedLeaves: NeuralAtlasNode[];
  onClose: () => void;
  onOpen: (node: NeuralAtlasNode) => void;
}) {
  const color = nodeTypeColors[leaf.type];

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-4 pb-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-leaf-title"
    >
      <motion.article
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto border border-white/10 bg-[#050914]/95 p-5 shadow-[0_0_80px_rgba(102,227,255,0.12)] backdrop-blur-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.25em]" style={{ color }}>
              {leaf.annotation}
            </p>
            <h2 id="atlas-leaf-title" className="mt-2 text-3xl font-black leading-tight text-text-primary">
              {leaf.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:text-cyan"
            aria-label="Close detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-base leading-7 text-text-secondary">{leaf.summary}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(leaf.domains ?? []).map((domain) => (
            <span key={domain} className="border border-violet/20 bg-violet/10 px-2.5 py-1 text-xs text-violet">
              {domain}
            </span>
          ))}
          {(leaf.tags ?? []).slice(0, 8).map((tag) => (
            <span key={tag} className="border border-cyan/15 bg-cyan/[0.06] px-2.5 py-1 text-xs text-cyan/90">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={leaf.route} className="signal-button">
            Read canonical page <ArrowUpRight className="h-4 w-4" />
          </Link>
          {leaf.sourceUrl && (
            <a href={leaf.sourceUrl} target="_blank" rel="noopener noreferrer" className="signal-button border-white/15 bg-white/[0.035] text-text-secondary">
              External source <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <Link href={`/neural-net?focus=${leaf.sourceSlug ?? leaf.id}`} className="signal-button border-white/15 bg-white/[0.035] text-text-secondary">
            Graph archive
          </Link>
        </div>

        {relatedLeaves.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">related neurons</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {relatedLeaves.map((related) => (
                <button
                  key={related.id}
                  type="button"
                  onClick={() => onOpen(related)}
                  className="border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-cyan/30 hover:bg-cyan/[0.055]"
                >
                  <span className="block text-sm font-semibold text-text-primary">{related.label}</span>
                  <span className="mt-1 block text-xs text-text-muted">{related.annotation}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.article>
    </motion.div>
  );
}

function AtlasPalette({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (node: NeuralAtlasNode) => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[75] flex items-start justify-center bg-black/50 px-4 pt-24 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-palette-title"
    >
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -18 }}
        className="w-full max-w-2xl border border-white/10 bg-[#050914]/96 p-4 shadow-[0_0_70px_rgba(167,139,250,0.14)] backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan/80">command palette</p>
            <h2 id="atlas-palette-title" className="mt-1 text-lg font-black text-text-primary">
              Jump to a category soma
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:text-cyan"
            aria-label="Close palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {atlasCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onOpen(category)}
              className="group border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-cyan/30 hover:bg-cyan/[0.055]"
            >
              <span className="block text-sm font-semibold text-text-primary group-hover:text-cyan">{category.label}</span>
              <span className="mt-1 block text-xs leading-5 text-text-muted">{category.summary}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
