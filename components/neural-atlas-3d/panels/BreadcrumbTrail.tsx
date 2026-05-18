'use client';

import { useAtlasStore } from '../atlasStore';

type BreadcrumbTrailProps = {
  categoryTitle?: string | null;
};

export function BreadcrumbTrail({ categoryTitle }: BreadcrumbTrailProps) {
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const returnToOverview = useAtlasStore((state) => state.returnToOverview);

  return (
    <div className="flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.18em] text-text-muted">
      <button type="button" onClick={returnToOverview} className="text-cyan hover:text-cyan-100">
        Sid Neural Net
      </button>
      {activeCategoryId && (
        <>
          <span>/</span>
          <span>{categoryTitle ?? activeCategoryId}</span>
        </>
      )}
      <span className="ml-auto">{transitionPhase}</span>
    </div>
  );
}
