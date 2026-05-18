'use client';

import type { AtlasNode } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';

type CategoryPreviewPanelProps = {
  categories: AtlasNode[];
};

export function CategoryPreviewPanel({ categories }: CategoryPreviewPanelProps) {
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const focusCategory = useAtlasStore((state) => state.focusCategory);

  return (
    <div className="grid gap-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => focusCategory(category.id)}
          className={`border px-3 py-2 text-left transition-colors ${
            activeCategoryId === category.id
              ? 'border-cyan/40 bg-cyan/[0.1] text-cyan'
              : 'border-white/10 bg-white/[0.035] text-text-secondary hover:text-text-primary'
          }`}
        >
          <span className="block text-sm font-semibold">{category.shortLabel}</span>
          <span className="mt-1 block text-xs leading-5 text-text-muted">{category.summary}</span>
        </button>
      ))}
    </div>
  );
}
