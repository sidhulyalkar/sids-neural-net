'use client';

import type { AtlasGraph } from './atlasTypes';
import { useAtlasStore } from './atlasStore';
import { AtlasCommandPalette } from './panels/AtlasCommandPalette';
import { BreadcrumbTrail } from './panels/BreadcrumbTrail';
import { CategoryPreviewPanel } from './panels/CategoryPreviewPanel';

type NeuralAtlasOverlayProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasOverlay({ graph }: NeuralAtlasOverlayProps) {
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const activeNodeId = useAtlasStore((state) => state.activeNodeId);
  const hoveredNodeId = useAtlasStore((state) => state.hoveredNodeId);
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const returnToOverview = useAtlasStore((state) => state.returnToOverview);
  const previewNode =
    graph.categories.find((node) => node.id === hoveredNodeId) ??
    graph.categories.find((node) => node.id === activeCategoryId) ??
    graph.categories.find((node) => node.id === 'about') ??
    null;
  const activeCategory = graph.categories.find((node) => node.id === activeCategoryId) ?? null;
  const activeNode = graph.nodes.find((node) => node.id === activeNodeId) ?? activeCategory;
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

      <div className="pointer-events-auto max-w-md border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
        <BreadcrumbTrail />
        <h1 className="mt-4 text-3xl font-black leading-tight text-text-primary">Neural Atlas</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          A root-level 3D tissue map over the generated graph. Select a category soma to prime the signal path.
        </p>
        {activeCategory && (
          <button type="button" onClick={returnToOverview} className="signal-button mt-4 border-white/15 bg-white/[0.035] text-text-secondary">
            Reset view
          </button>
        )}
        <div className="mt-4">
          <CategoryPreviewPanel categories={graph.categories} />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 w-[min(24rem,calc(100vw-2rem))] sm:bottom-6 sm:left-6">
        <AtlasCommandPalette nodes={graph.categories} />
      </div>

      {previewNode && (
        <div className="pointer-events-auto absolute right-4 top-4 w-[min(24rem,calc(100vw-2rem))] border border-white/10 bg-black/35 p-4 backdrop-blur-xl sm:right-6 sm:top-6">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan/75">
            {previewNode.kind} / {previewNode.morphology}
          </p>
          <h2 className="mt-2 text-xl font-black text-text-primary">{previewNode.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{previewNode.summary}</p>
        </div>
      )}

    </div>
  );
}
