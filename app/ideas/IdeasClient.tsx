'use client';

import { useState, useEffect } from 'react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { IdeaLandscape, IdeaList } from '@/components/ideas/IdeaLandscape';
import { researchIdeas } from '@/data/research-ideas';

export default function IdeasClient() {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ComicSectionLayout
      eyebrow="research"
      title="research ideas"
    >
      <p className="mb-8 max-w-2xl text-sm text-text-secondary">
        Research directions I'm exploring or thinking about. Click on nodes to expand details.
        Ideas span neural data infrastructure, foundation models, mechanistic interpretability, and scientific tooling.
      </p>

      {!isClient ? (
        // Server-side fallback
        <div className="grid gap-4 md:grid-cols-2">
          {researchIdeas.slice(0, 4).map((idea) => (
            <div key={idea.id} className="future-circuit-card p-5">
              <h3 className="text-lg font-semibold text-text-primary">{idea.title}</h3>
              <p className="mt-2 text-sm text-cyan">{idea.thesis}</p>
            </div>
          ))}
        </div>
      ) : isMobile ? (
        <IdeaList ideas={researchIdeas} />
      ) : (
        <IdeaLandscape ideas={researchIdeas} />
      )}

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-6">
        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Status:</span>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green" />
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber" />
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet" />
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">Sketch</span>
        </div>
      </div>
    </ComicSectionLayout>
  );
}
