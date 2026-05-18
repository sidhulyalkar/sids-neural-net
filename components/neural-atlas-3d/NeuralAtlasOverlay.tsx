'use client';

import type { AtlasGraph } from './atlasTypes';
import { useAtlasStore } from './atlasStore';
import { AtlasCommandPalette } from './panels/AtlasCommandPalette';
import { BreadcrumbTrail } from './panels/BreadcrumbTrail';
import { CategoryPreviewPanel } from './panels/CategoryPreviewPanel';
import { LeafDetailPanel } from './panels/LeafDetailPanel';

type NeuralAtlasOverlayProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasOverlay({ graph }: NeuralAtlasOverlayProps) {
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const openDetail = useAtlasStore((state) => state.openDetail);
  const selectedNode = graph.nodes.find((node) => node.id === selectedLeafId) ?? null;
  const activeCategory = graph.categories.find((node) => node.id === activeCategoryId) ?? null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 p-4 sm:p-6">
      <div className="pointer-events-auto max-w-md border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
        <BreadcrumbTrail />
        <h1 className="mt-4 text-3xl font-black leading-tight text-text-primary">Neural Atlas</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          A scaffolded 3D tissue map over the generated graph. Select a soma to focus a subnetwork.
        </p>
        <div className="mt-4">
          <CategoryPreviewPanel categories={graph.categories} />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 w-[min(24rem,calc(100vw-2rem))] sm:bottom-6 sm:left-6">
        <AtlasCommandPalette nodes={graph.nodes} />
      </div>

      {(selectedNode ?? activeCategory) && (
        <div className="pointer-events-auto absolute right-4 top-4 w-[min(24rem,calc(100vw-2rem))] border border-white/10 bg-black/35 p-4 backdrop-blur-xl sm:right-6 sm:top-6">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan/75">
          {(selectedNode ?? activeCategory)?.kind}
        </p>
        <h2 className="mt-2 text-xl font-black text-text-primary">{(selectedNode ?? activeCategory)?.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{(selectedNode ?? activeCategory)?.summary}</p>
          {selectedNode && (
            <button type="button" onClick={() => openDetail(selectedNode.id)} className="signal-button mt-4">
              Open detail
            </button>
          )}
        </div>
      )}

      <LeafDetailPanel node={selectedNode} />
    </div>
  );
}
