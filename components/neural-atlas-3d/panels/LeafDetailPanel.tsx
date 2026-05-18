'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import type { AtlasNode } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';

type LeafDetailPanelProps = {
  node: AtlasNode | null;
};

export function LeafDetailPanel({ node }: LeafDetailPanelProps) {
  const closeDetail = useAtlasStore((state) => state.closeDetail);
  const openDetail = useAtlasStore((state) => state.openDetail);

  if (!node) return null;

  return (
    <aside className="pointer-events-auto fixed bottom-4 right-4 z-40 max-h-[70vh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto border border-white/10 bg-bg-deep/92 p-5 shadow-[0_0_70px_rgba(102,227,255,0.12)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan/75">{node.kind}</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-text-primary">{node.title}</h2>
        </div>
        <button type="button" onClick={closeDetail} className="text-text-muted hover:text-cyan" aria-label="Close detail">
          <X className="h-5 w-5" />
        </button>
      </div>
      {node.summary && <p className="mt-3 text-sm leading-6 text-text-secondary">{node.summary}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {node.domains.slice(0, 3).map((domain) => (
          <span key={domain} className="border border-violet/20 bg-violet/10 px-2 py-1 text-xs text-violet">
            {domain}
          </span>
        ))}
        {node.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="border border-cyan/15 bg-cyan/[0.06] px-2 py-1 text-xs text-cyan/90">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={node.route} className="signal-button">
          Open route
        </Link>
        {node.kind === 'leaf' && (
          <button type="button" onClick={() => openDetail(node.id)} className="signal-button border-white/15 bg-white/[0.035] text-text-secondary">
            Keep focus
          </button>
        )}
      </div>
    </aside>
  );
}
