'use client';

import { useLayoutEffect } from 'react';

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

const ACTIVE_PUBLIC_MORPHOLOGIES = ['radial', 'coral', 'fan', 'apical', 'spiraloid', 'echo-nest'] as const;
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

type WeightedMorphology = readonly [(typeof ACTIVE_PUBLIC_MORPHOLOGIES)[number], number];

function cleanSeed(seed: string | undefined): string {
  return (
    seed
      ?.replace(/^force:[a-z-]+:/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 72) || 'curated-v14'
  );
}

function freshEntropy(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.round(performance.now()).toString(36)}`;
}

function seededUnit(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  state += 0x6d2b79f5;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function weightedPick(items: readonly WeightedMorphology[], seed: string): (typeof ACTIVE_PUBLIC_MORPHOLOGIES)[number] {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seededUnit(seed) * total;
  for (const [morphology, weight] of items) {
    cursor -= weight;
    if (cursor <= 0) return morphology;
  }
  return items[items.length - 1]?.[0] ?? 'coral';
}

function choosePublicMorphology(width: number, height: number, seed: string) {
  const aspect = width / Math.max(1, height);
  if (width < 480 || aspect < 0.82) {
    return weightedPick(
      [
        ['apical', 0.31],
        ['spiraloid', 0.24],
        ['coral', 0.17],
        ['echo-nest', 0.13],
        ['radial', 0.09],
        ['fan', 0.06],
      ],
      `${seed}:portrait-v14`
    );
  }
  if (aspect > 1.7) {
    return weightedPick(
      [
        ['fan', 0.28],
        ['coral', 0.24],
        ['radial', 0.16],
        ['echo-nest', 0.15],
        ['spiraloid', 0.1],
        ['apical', 0.07],
      ],
      `${seed}:wide-v14`
    );
  }
  return weightedPick(
    [
      ['coral', 0.22],
      ['radial', 0.2],
      ['echo-nest', 0.2],
      ['spiraloid', 0.15],
      ['fan', 0.13],
      ['apical', 0.1],
    ],
    `${seed}:balanced-v14`
  );
}

function curateLocationBeforeGeneration() {
  const url = new URL(window.location.href);
  const requested = url.searchParams.get('morph')?.toLowerCase() ?? null;
  if (requested && ACTIVE_PUBLIC_MORPHOLOGIES.includes(requested as (typeof ACTIVE_PUBLIC_MORPHOLOGIES)[number])) {
    return;
  }

  const seed = cleanSeed(url.searchParams.get('seed') ?? freshEntropy());
  const morphology = requested && RETIRED_PUBLIC_MORPHOLOGIES.has(requested)
    ? RETIRED_FALLBACKS[requested] ?? 'coral'
    : choosePublicMorphology(window.innerWidth, window.innerHeight, seed);
  url.searchParams.set('morph', morphology);
  url.searchParams.set('seed', seed);
  window.history.replaceState(window.history.state, '', url.toString());
}

function hideAuxiliaryFractalLayers() {
  document
    .querySelectorAll<HTMLElement>('[data-fractal-surface-enhancer], [data-fractal-experience]')
    .forEach((element) => {
      element.style.visibility = 'hidden';
    });
}

function rewriteRetiredMorphology(root: HTMLElement, morphology: string) {
  const fallback = RETIRED_FALLBACKS[morphology] ?? 'coral';
  root.style.visibility = 'hidden';
  hideAuxiliaryFractalLayers();
  const url = new URL(window.location.href);
  url.searchParams.set('morph', fallback);
  url.searchParams.set('seed', cleanSeed(root.dataset.fractalSeed));
  window.location.replace(url.toString());
}

export function FractalPublicCurationV14() {
  useLayoutEffect(() => {
    curateLocationBeforeGeneration();
    let frame = 0;
    let redirecting = false;

    const apply = () => {
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
      root.dataset.destinationClearance = 'opaque-card-v14';
      for (const id of DESTINATION_IDS) {
        const link = document.querySelector<HTMLElement>(`[data-dendrite-destination="${id}"]`);
        if (link) link.dataset.destinationEdgeClearance = 'v14';
      }
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    schedule();
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-fractal-morphology', 'data-fractal-seed'],
    });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <style>{`
      [data-dendrite-destination] {
        background-color: #010406 !important;
        isolation: isolate;
      }
      [data-dendrite-destination]:hover,
      [data-dendrite-destination]:focus-visible {
        background-color: #02070a !important;
      }
    `}</style>
  );
}
