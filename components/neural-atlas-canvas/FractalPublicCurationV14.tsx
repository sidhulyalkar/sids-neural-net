'use client';

import { useLayoutEffect, useState } from 'react';

const DESTINATION_IDS = [
  'frontier',
  'games',
  'builds',
  'systems',
  'contact',
  'visuals',
  'research',
  'papers',
] as const;

const RETIRED_PUBLIC_MORPHOLOGIES = new Set([
  'aurora',
  'mycelial',
  'tectonic',
  'halo',
  'pixel-ghost',
  'echidna',
]);

const RETIRED_FALLBACKS: Record<string, string> = {
  aurora: 'fan',
  mycelial: 'echo-nest',
  tectonic: 'coral',
  halo: 'apical',
  'pixel-ghost': 'echo-nest',
  echidna: 'fan',
};

type MaskRect = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function cleanSeed(seed: string | undefined): string {
  return (
    seed
      ?.replace(/^force:[a-z-]+:/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 72) || 'curated-v14'
  );
}

function rewriteRetiredMorphology(root: HTMLElement, morphology: string) {
  const fallback = RETIRED_FALLBACKS[morphology] ?? 'coral';
  root.style.visibility = 'hidden';
  const url = new URL(window.location.href);
  url.searchParams.set('morph', fallback);
  url.searchParams.set('seed', cleanSeed(root.dataset.fractalSeed));
  window.location.replace(url.toString());
}

export function FractalPublicCurationV14() {
  const [masks, setMasks] = useState<MaskRect[]>([]);

  useLayoutEffect(() => {
    let frame = 0;
    let redirecting = false;

    const measure = () => {
      if (redirecting) return;
      const root = document.querySelector<HTMLElement>('[data-fractal-morphology]');
      if (!root) return;
      const morphology = root.dataset.fractalMorphology;
      if (!morphology || morphology === 'measuring') return;

      if (RETIRED_PUBLIC_MORPHOLOGIES.has(morphology)) {
        redirecting = true;
        rewriteRetiredMorphology(root, morphology);
        return;
      }

      root.style.visibility = '';
      root.dataset.publicCuration = 'v14';
      root.dataset.destinationClearance = 'opaque-edge-mask-v14';

      const next: MaskRect[] = [];
      for (const id of DESTINATION_IDS) {
        const link = document.querySelector<HTMLElement>(`[data-dendrite-destination="${id}"]`);
        if (!link) continue;
        link.dataset.destinationEdgeClearance = 'v14';
        const rect = link.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        next.push({
          id,
          left: rect.left + 0.75,
          top: rect.top + 0.75,
          width: Math.max(0, rect.width - 1.5),
          height: Math.max(0, rect.height - 1.5),
        });
      }
      setMasks(next);
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    const resizeObserver = new ResizeObserver(schedule);
    document.querySelectorAll<HTMLElement>('[data-dendrite-destination]').forEach((link) => resizeObserver.observe(link));
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <>
      <style>{`
        [data-dendrite-destination] {
          background-color: #010406 !important;
        }
        [data-dendrite-destination]:hover,
        [data-dendrite-destination]:focus-visible {
          background-color: #02070a !important;
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 z-[19]" aria-hidden="true" data-destination-clearance-layer="v14">
        {masks.map((mask) => (
          <div
            key={mask.id}
            data-destination-clearance-mask={mask.id}
            className="fixed rounded-[2px] bg-[#010406]"
            style={{ left: mask.left, top: mask.top, width: mask.width, height: mask.height }}
          />
        ))}
      </div>
    </>
  );
}
