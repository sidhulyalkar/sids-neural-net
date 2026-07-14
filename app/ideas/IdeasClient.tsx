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
      <div className="mb-10 max-w-3xl space-y-4">
        <p className="text-base leading-relaxed text-text-secondary">
          A living map of the questions I keep returning to: neural dynamics, dataset reuse,
          source-level data thinking, naturalistic-video brain encoding, quantum-inspired
          interfaces, and scientific systems that preserve context from raw signal to interpretation.
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          The moving nodes mirror how these interests tend to exist in my head: separate ideas
          until they collide, exchange energy, and become a larger research direction.
        </p>
      </div>

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

      {/* Status legend */}
      <div className="mt-12 flex items-center justify-center gap-8 border-t border-white/5 pt-8">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-text-primary" />
          <span className="text-[0.65rem] text-text-muted">active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
          <span className="text-[0.65rem] text-text-muted">draft</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-text-muted/50" />
          <span className="text-[0.65rem] text-text-muted">sketch</span>
        </div>
      </div>
    </ComicSectionLayout>
  );
}
