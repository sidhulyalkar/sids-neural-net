'use client';

import { useMemo, useState } from 'react';
import type { AtlasNode } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';

type AtlasCommandPaletteProps = {
  nodes: AtlasNode[];
};

export function AtlasCommandPalette({ nodes }: AtlasCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const focusCategory = useAtlasStore((state) => state.focusCategory);
  const focusLeaf = useAtlasStore((state) => state.focusLeaf);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return nodes.slice(0, 12);
    return nodes
      .filter((node) => [node.title, node.summary ?? '', node.slug].join(' ').toLowerCase().includes(normalized))
      .slice(0, 12);
  }, [nodes, query]);

  const openNode = (node: AtlasNode) => {
    if (node.kind === 'category') focusCategory(node.id);
    else focusLeaf(node.id, node.parentId);
  };

  return (
    <div className="border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find neuron..."
        className="w-full border border-white/10 bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
      />
      <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto">
        {filtered.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => openNode(node)}
            className="px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-white/[0.06] hover:text-cyan focus:bg-white/[0.06] focus:text-cyan focus:outline-none"
          >
            <span className="block">{node.title}</span>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-text-muted">{node.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
