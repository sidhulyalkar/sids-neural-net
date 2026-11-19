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

/** A sprite pop is an opportunity-normalized micro-engagement signal, not an
 * explicit like or a dislike. The majority of preference authority remains
 * article-opening and saving; clearing an ornament alone must not masquerade
 * as genuine scientific interest. */
export function ambientEngagementAdjustment(entry?: FrontierHistoryEntry): number {
  if (!entry) return 0;
  const appearances = Math.max(0, Math.floor(entry.ambientAppearances ?? 0));
  const pops = Math.max(0, Math.floor(entry.ambientPops ?? 0));
  if (!appearances || !pops) return 0;
  const clickRate = Math.min(pops, appearances) / appearances;
  const hasSubstantiveAction = Boolean(entry.openedAt) || (entry.dwellMs ?? 0) >= 12000;
  return Math.min(0.018, clickRate * (hasSubstantiveAction ? 0.018 : 0.002));
}
