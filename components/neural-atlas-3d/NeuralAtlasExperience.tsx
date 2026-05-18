'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AtlasNode } from './atlasTypes';
import { buildAtlasGraph } from './atlasDataAdapter';
import { useAtlasStore } from './atlasStore';
import { NeuralAtlasFallback } from './NeuralAtlasFallback';
import { NeuralAtlasLoading } from './NeuralAtlasLoading';
import { NeuralAtlasOverlay } from './NeuralAtlasOverlay';

const NeuralAtlasCanvas = dynamic(
  () => import('./NeuralAtlasCanvas').then((module) => module.NeuralAtlasCanvas),
  {
    ssr: false,
    loading: () => <NeuralAtlasLoading />,
  }
);

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function NeuralAtlasExperience() {
  const graph = useMemo(() => buildAtlasGraph(), []);
  const hydratedFromUrl = useRef(false);
  const [fallbackReason, setFallbackReason] = useState<'reduced-motion' | 'webgl-unavailable' | null>(null);
  const setReducedMotion = useAtlasStore((state) => state.setReducedMotion);
  const goBack = useAtlasStore((state) => state.goBack);
  const restoreNavigation = useAtlasStore((state) => state.restoreNavigation);
  const focusCategory = useAtlasStore((state) => state.focusCategory);
  const focusLeaf = useAtlasStore((state) => state.focusLeaf);
  const setHoveredNode = useAtlasStore((state) => state.setHoveredNode);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const hoveredNodeId = useAtlasStore((state) => state.hoveredNodeId);
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(prefersReducedMotion);
    if (prefersReducedMotion) {
      setFallbackReason('reduced-motion');
      return;
    }
    if (!canUseWebGL()) {
      setFallbackReason('webgl-unavailable');
    }
  }, [setReducedMotion]);

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const atlasParam = params.get('atlas');
    const nodeParam = params.get('node');
    const category = atlasParam ? graph.categories.find((node) => node.slug === atlasParam || node.id === atlasParam) : null;
    const leaf = nodeParam
      ? graph.nodes.find((node) => node.kind === 'leaf' && (node.slug === nodeParam || node.id === nodeParam))
      : null;

    if (leaf) {
      restoreNavigation(leaf.parentId ?? category?.id ?? null, leaf.id);
      return;
    }
    if (category) restoreNavigation(category.id);
  }, [graph.categories, graph.nodes, restoreNavigation]);

  useEffect(() => {
    if (!hydratedFromUrl.current || fallbackReason) return;

    const params = new URLSearchParams(window.location.search);
    const category = activeCategoryId ? graph.categories.find((node) => node.id === activeCategoryId) : null;
    const leaf = selectedLeafId ? graph.nodes.find((node) => node.id === selectedLeafId) : null;

    if (category) params.set('atlas', category.slug);
    else params.delete('atlas');

    if (leaf) params.set('node', leaf.slug);
    else params.delete('node');

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [activeCategoryId, fallbackReason, graph.categories, graph.nodes, selectedLeafId]);

  useEffect(() => {
    const isTransitioning = transitionPhase === 'charging' || transitionPhase === 'traveling' || transitionPhase === 'arriving';
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;

      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        goBack();
        return;
      }

      if (event.key === 'Enter') {
        const node = hoveredNodeId ? graph.nodes.find((candidate) => candidate.id === hoveredNodeId) : null;
        if (!node || isTransitioning) return;
        event.preventDefault();
        if (node.kind === 'category') focusCategory(node.id);
        else focusLeaf(node.id, node.parentId);
        return;
      }

      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key) || isTransitioning) return;
      event.preventDefault();
      const visibleNodes = visibleNavigationNodes(graph.nodes, activeCategoryId, selectedLeafId);
      if (visibleNodes.length === 0) return;
      const currentIndex = visibleNodes.findIndex((node) => node.id === hoveredNodeId);
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : visibleNodes.length - 1
          : (currentIndex + direction + visibleNodes.length) % visibleNodes.length;
      setHoveredNode(visibleNodes[nextIndex].id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeCategoryId,
    focusCategory,
    focusLeaf,
    goBack,
    graph.nodes,
    hoveredNodeId,
    selectedLeafId,
    setHoveredNode,
    transitionPhase,
  ]);

  if (fallbackReason) {
    return <NeuralAtlasFallback reason={fallbackReason} />;
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-bg-deep text-text-primary">
      <NeuralAtlasCanvas graph={graph} />
      <NeuralAtlasOverlay graph={graph} />
    </section>
  );
}

function visibleNavigationNodes(nodes: AtlasNode[], activeCategoryId: string | null, selectedLeafId: string | null) {
  if (!activeCategoryId) return nodes.filter((node) => node.kind === 'category');

  return nodes.filter(
    (node) =>
      node.id === activeCategoryId ||
      node.id === selectedLeafId ||
      node.parentId === activeCategoryId
  );
}
