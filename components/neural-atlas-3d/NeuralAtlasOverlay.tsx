'use client';

import { AnimatePresence } from 'framer-motion';
import type { AtlasGraph, AtlasNode } from './atlasTypes';
import { useAtlasStore } from './atlasStore';
import { AtlasCommandPalette } from './panels/AtlasCommandPalette';
import { BreadcrumbTrail } from './panels/BreadcrumbTrail';
import { CategoryPreviewPanel } from './panels/CategoryPreviewPanel';
import { LeafDetailPanel } from './panels/LeafDetailPanel';

type NeuralAtlasOverlayProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasOverlay({ graph }: NeuralAtlasOverlayProps) {
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const activeNodeId = useAtlasStore((state) => state.activeNodeId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const hoveredNodeId = useAtlasStore((state) => state.hoveredNodeId);
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const returnToOverview = useAtlasStore((state) => state.returnToOverview);
  const focusLeaf = useAtlasStore((state) => state.focusLeaf);
  const previewNode =
    graph.nodes.find((node) => node.id === hoveredNodeId && node.kind !== 'root') ??
    graph.categories.find((node) => node.id === activeCategoryId) ??
    graph.categories.find((node) => node.id === 'about') ??
    null;
  const activeCategory = graph.categories.find((node) => node.id === activeCategoryId) ?? null;
  const activeNode = graph.nodes.find((node) => node.id === activeNodeId) ?? activeCategory;
  const selectedLeaf = graph.nodes.find((node) => node.id === selectedLeafId) ?? null;
  const detailReady = transitionPhase === 'detail' || transitionPhase === 'reading';
  const detailNode = detailReady ? selectedLeaf : null;
  const relatedLeafNodes = detailNode
    ? detailNode.relatedIds
        .map((relatedId) => graph.nodes.find((node) => node.id === relatedId))
        .filter((node): node is AtlasNode => node != null && node.kind === 'leaf' && node.id !== detailNode.id)
        .slice(0, 6)
    : [];
  const categoryChildren = activeCategoryId
    ? graph.nodes
        .filter((node) => node.kind === 'leaf' && node.parentId === activeCategoryId)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 9)
    : [];
  const commandNodes = activeCategory ? [activeCategory, ...categoryChildren] : graph.categories;
  const signalActive = transitionPhase === 'charging' || transitionPhase === 'traveling' || transitionPhase === 'arriving';

  return (
    <div className="pointer-events-none absolute inset-0 z-30 p-4 sm:p-6">
      {transitionPhase === 'arriving' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(248,251,255,0.2),rgba(102,227,255,0.1)_24%,transparent_58%)] opacity-80" />
      )}

      {signalActive && activeNode && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 border border-white/10 bg-black/30 px-4 py-3 text-center backdrop-blur-xl">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-cyan/80">signal propagation</p>
          <p className="mt-1 max-w-[18rem] truncate text-sm font-semibold text-text-primary">{activeNode.title}</p>
        </div>
      )}

      <div className="pointer-events-auto max-w-md border border-white/10 bg-black/[0.35] p-4 backdrop-blur-xl">
        <BreadcrumbTrail
          categoryTitle={activeCategory?.shortLabel ?? activeCategory?.title}
          leafTitle={detailNode?.shortLabel ?? detailNode?.title}
        />
        <h1 className="mt-4 text-3xl font-black leading-tight text-text-primary">Neural Atlas</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {activeCategory
            ? activeCategory.summary
            : 'Navigate my research, engineering, and creative work. Click a category node to explore deeper.'}
        </p>
        {activeCategory && (
          <button
            type="button"
            onClick={returnToOverview}
            className="signal-button mt-4 border-white/15 bg-white/[0.035] text-text-secondary"
            aria-label="Back to cortex overview"
          >
            Back to Cortex
          </button>
        )}
        {!activeCategory ? (
          <div className="mt-4">
            <CategoryPreviewPanel categories={graph.categories} />
          </div>
        ) : (
          <div className="mt-4 grid max-h-[42vh] gap-2 overflow-y-auto pr-1">
            {categoryChildren.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => focusLeaf(node.id, node.parentId)}
                className={`border px-3 py-2 text-left transition-colors ${
                  selectedLeafId === node.id
                    ? 'border-cyan/40 bg-cyan/[0.1] text-cyan'
                    : 'border-white/10 bg-white/[0.035] text-text-secondary hover:text-text-primary focus:border-cyan/40 focus:text-cyan focus:outline-none'
                }`}
              >
                <span className="block text-sm font-semibold">{node.shortLabel}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">{node.summary}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 w-[min(24rem,calc(100vw-2rem))] sm:bottom-6 sm:left-6">
        <AtlasCommandPalette nodes={commandNodes} />
      </div>

      {previewNode && !detailNode && (
        <div className="pointer-events-auto absolute right-4 top-4 w-[min(24rem,calc(100vw-2rem))] border border-white/10 bg-black/[0.35] p-4 backdrop-blur-xl sm:right-6 sm:top-6">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan/75">
            {previewNode.kind} / {previewNode.morphology}
          </p>
          <h2 className="mt-2 text-xl font-black text-text-primary">{previewNode.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{previewNode.summary}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {detailNode && <LeafDetailPanel key={detailNode.id} node={detailNode} relatedNodes={relatedLeafNodes} />}
      </AnimatePresence>
    </div>
  );
}
