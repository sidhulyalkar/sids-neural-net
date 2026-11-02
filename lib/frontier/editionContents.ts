import type { FrontierItem, FrontierLaneId } from './types';

export type FrontierEditionGroupId = 'research' | 'sports' | 'culture' | 'world' | 'other';
export type FrontierEditionEntry = { item: FrontierItem; position: number };
export type FrontierEditionGroup = {
  id: FrontierEditionGroupId;
  label: string;
  entries: FrontierEditionEntry[];
};

const GROUPS: readonly { id: FrontierEditionGroupId; label: string; lanes: readonly FrontierLaneId[] }[] = [
  { id: 'research', label: 'Research & tools',
    lanes: ['ml_data', 'ai_frontier', 'neuro_frontier', 'methods', 'builder_signal', 'competitions', 'broad_science'] },
  { id: 'sports', label: 'Sports & performance',
    lanes: ['premier_league', 'world_soccer', 'team_pulse', 'sports'] },
  { id: 'culture', label: 'Creative & culture',
    lanes: ['creative_tech', 'gaming', 'screen', 'music', 'internet_culture'] },
  { id: 'world', label: 'World & life',
    lanes: ['must_know', 'world_pulse', 'life'] },
  { id: 'other', label: 'Discoveries', lanes: ['wildcards'] },
];

/**
 * Navigation is a view over the curated order, never a second ranker.
 * Grouping must not quietly shift personalization, source diversity, or the
 * canonical first 14 cards. Store positions, not duplicated article bodies.
 */
export function buildFrontierEditionContents(items: readonly FrontierItem[]): FrontierEditionGroup[] {
  const result = GROUPS.map(({ id, label }) => ({ id, label, entries: [] as FrontierEditionEntry[] }));
  for (const [position, item] of items.entries()) {
    const index = Math.max(0, GROUPS.findIndex(({ lanes }) => lanes.includes(item.lane)));
    result[index].entries.push({ position, item });
  }
  return result.filter((group) => group.entries.length > 0);
}

export function frontierReaderFormat(item: FrontierItem): string {
  if (item.sportsState || item.sourceKind === 'sports_state') return 'Live data';
  if (['arxiv', 'openalex', 'biorxiv', 'medrxiv', 'openreview', 'paperswithcode', 'huggingface'].includes(item.sourceKind)) {
    return 'Research';
  }
  if (item.sourceKind === 'github') return 'Code';
  if (item.sourceKind === 'youtube' || item.sourceKind === 'vimeo') return 'Video';
  if (item.sourceKind === 'steam') return 'Game';
  if (['hackernews', 'lobsters', 'reddit', 'social'].includes(item.sourceKind)) return 'Discussion';
  return 'Article';
}
