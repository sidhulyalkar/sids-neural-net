'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Menu, X } from 'lucide-react';
import type { AtlasGraph } from './atlasTypes';
import { useAtlasStore } from './atlasStore';

const navLinks = [
  { href: '/case-studies', label: 'Case Studies' },
  { href: '/projects', label: 'Projects' },
  { href: '/publications', label: 'Publications' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/photography', label: 'Photography' },
  { href: '/field-notes', label: 'Field Notes' },
  { href: '/neural-net', label: 'Full Graph' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

type ImmersiveAtlasUIProps = {
  graph: AtlasGraph;
};

export function ImmersiveAtlasUI({ graph }: ImmersiveAtlasUIProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const closeDetail = useAtlasStore((state) => state.closeDetail);
  const returnToOverview = useAtlasStore((state) => state.returnToOverview);
  const goBack = useAtlasStore((state) => state.goBack);
  const activeCategory = activeCategoryId ? graph.categories.find((node) => node.id === activeCategoryId) : null;
  const selectedLeaf = selectedLeafId ? graph.nodes.find((node) => node.id === selectedLeafId) : null;

  return (
    <>
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed left-5 top-5 z-50 border border-white/10 bg-black/50 p-3 text-white/70 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {(activeCategory || selectedLeaf) && (
        <div className="fixed left-5 top-[4.75rem] z-40 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 text-xs text-[#f4f1eb]/70">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 border border-white/10 bg-black/45 px-3 py-2 font-mono uppercase tracking-[0.16em] transition-colors hover:border-[#f4f1eb]/40 hover:text-[#f4f1eb]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          {selectedLeaf && (
            <button
              type="button"
              onClick={closeDetail}
              className="border border-white/10 bg-black/35 px-3 py-2 font-mono uppercase tracking-[0.16em] transition-colors hover:border-[#f4f1eb]/40 hover:text-[#f4f1eb]"
            >
              {activeCategory?.shortLabel ?? 'Parent'}
            </button>
          )}
          <button
            type="button"
            onClick={returnToOverview}
            className="border border-white/10 bg-black/35 px-3 py-2 font-mono uppercase tracking-[0.16em] transition-colors hover:border-[#f4f1eb]/40 hover:text-[#f4f1eb]"
          >
            Cortex
          </button>
          {selectedLeaf && (
            <Link
              href={selectedLeaf.route}
              className="inline-flex items-center gap-2 border border-white/10 bg-black/35 px-3 py-2 font-mono uppercase tracking-[0.16em] transition-colors hover:border-[#f4f1eb]/40 hover:text-[#f4f1eb]"
            >
              Page
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex justify-center pb-8">
          <h1 className="atlas-name-display text-center text-[#f4f1eb]/90">
            SIDHARTH HULYALKAR
          </h1>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md">
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute right-5 top-5 border border-white/10 p-3 text-white/70 transition-colors hover:border-white/30 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>

          <nav className="flex h-full flex-col items-center justify-center gap-4 px-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-center text-xl font-light uppercase tracking-[0.16em] text-[#f4f1eb]/58 transition-colors hover:text-[#f4f1eb] sm:text-2xl"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
