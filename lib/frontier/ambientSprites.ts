import type { FrontierHistoryEntry, FrontierItem } from './types';

/** Newspaper ornament selection is deliberately bounded to a small, local icon
 * library. No source-controlled SVG/HTML and no remote assets execute here. */
export type FrontierMotif = 'newsprint' | 'soccer' | 'snow' | 'neuron' | 'code' | 'game' | 'music' | 'leaf';

export function frontierMotifForItem(item: FrontierItem): FrontierMotif {
  const subject = [item.title, ...item.tags].join(' ').toLowerCase();
  if (/skiing|snowboarding|snow sport|halfpipe|snowpack|winter sport/.test(subject)) return 'snow';
  if (['premier_league', 'world_soccer', 'team_pulse'].includes(item.lane) ||
    /soccer|football|fifa|uefa|premier league|world cup/.test(subject)) return 'soccer';
  if (item.lane === 'sports' || item.sourceKind === 'sports_state') return 'soccer';
  if (item.lane === 'music' || /\b(music|album|tracklist|concert|electronic music)\b/.test(subject)) return 'music';
  if (item.lane === 'gaming' || /\b(gaming|game design|video game|playstation|xbox)\b/.test(subject)) return 'game';
  if (item.sourceKind === 'nasa' || /\b(wildlife|ecology|nature|forest|marine|biodiversity)\b/.test(subject))
    return 'leaf';
  if (item.lane === 'neuro_frontier' || /\b(neural|neuron|brain|neuroscience|bci)\b/.test(subject))
    return 'neuron';
  if (item.lane === 'builder_signal' || item.sourceKind === 'github' || /\b(software|coding|developer)\b/.test(subject))
    return 'code';
  return 'newsprint';
}

/** Individual pops are intentionally expressive, but evidence strength grows
 * with the number of distinct catches and the fraction of opportunities used.
 * The clear-all oval is a separate explicit strong preference. */
export function ambientEngagementAdjustment(entry?: FrontierHistoryEntry): number {
  if (!entry) return 0;
  const appearances = Math.max(0, Math.floor(entry.ambientAppearances ?? 0));
  const pops = Math.max(0, Math.floor(entry.ambientPops ?? 0));
  const caught = Math.min(appearances, pops);
  const popSignal = appearances > 0 ? 0.24 * (caught / appearances) * Math.min(1, caught / 3) : 0;
  return Math.min(0.24, popSignal) + (entry.ambientClearedAt ? 0.62 : 0);
}

export type FrontierFlightPattern = 'hover' | 'patrol' | 'orbit' | 'zigzag' | 'cross';

export type FrontierSwarmSprite = {
  id: number;
  pattern: FrontierFlightPattern;
  x: number;
  y: number;
  duration: number;
  delay: number;
  size: number;
  /** One of six alternating hue families for controlled chromatic variation. */
  colorStep: number;
};

/** Deterministic, jittered distribution. No random layout changes during
 * hydration, and sprites do not all fly on identical phase or trajectories. */
export function frontierSwarmSprites(articleId: string, compact = false): FrontierSwarmSprite[] {
  let seed = 2166136261;
  for (let i = 0; i < articleId.length; i++) seed = Math.imul(seed ^ articleId.charCodeAt(i), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const count = compact ? 10 : 18;
  const patterns: FrontierFlightPattern[] = ['hover', 'patrol', 'orbit', 'zigzag', 'cross'];
  return Array.from({ length: count }, (_, id) => ({
    id,
    pattern: patterns[id % patterns.length],
    x: Math.round(17 + ((id * 37) % 66) + random() * 9),
    y: Math.round(12 + ((id * 23) % 60) + random() * 6),
    duration: Math.round((3.8 + random() * 5.8) * 100) / 100,
    delay: -Math.round(random() * 580) / 100,
    size: Math.round(30 + random() * 11),
    colorStep: (id + Math.floor(random() * 3)) % 7,
  }));
}
