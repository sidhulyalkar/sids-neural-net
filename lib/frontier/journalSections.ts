import type { FrontierItem } from './types';
import { journalRealm } from './journalPresentation';
import { journalSourceKind } from './journalSourceLens';

export type JournalSectionId =
  | 'for-you' | 'research' | 'engineering' | 'sports' | 'entertainment' | 'nature';

export type JournalSection = {
  id: JournalSectionId;
  label: string;
  subtitle: string;
  /** Optional atmosphere for a section with no current stories. */
  realm: 'research' | 'systems' | 'motion' | 'culture' | 'nature';
};

export const JOURNAL_SECTIONS: readonly JournalSection[] = [
  { id: 'for-you', label: 'For you', subtitle: 'A personally edited cross-disciplinary edition', realm: 'research' },
  { id: 'research', label: 'Research', subtitle: 'Brains, behavior, models and discovery', realm: 'research' },
  { id: 'engineering', label: 'Engineering', subtitle: 'Systems, code, tools and new techniques', realm: 'systems' },
  { id: 'sports', label: 'Sports', subtitle: 'Movement, matches and performance', realm: 'motion' },
  { id: 'entertainment', label: 'Entertainment', subtitle: 'Games, film, music and culture', realm: 'culture' },
  { id: 'nature', label: 'Nature', subtitle: 'Wildlife, oceans, ecosystems and Earth', realm: 'nature' },
] as const;

const RESEARCH_LANES = new Set(['ml_data', 'ai_frontier', 'neuro_frontier', 'methods', 'broad_science']);
const ENGINEERING_LANES = new Set(['builder_signal', 'competitions', 'creative_tech']);
const SPORTS_LANES = new Set(['premier_league', 'world_soccer', 'team_pulse', 'sports']);
const ENTERTAINMENT_LANES = new Set(['gaming', 'screen', 'music', 'internet_culture']);

/** An item may appear in more than one themed edition (e.g. neural research
 * software), but no section changes its canonical source provenance or rank. */
export function journalSectionMatches(item: FrontierItem, section: JournalSectionId): boolean {
  if (section === 'for-you') return true;
  const realm = journalRealm(item);
  const source = journalSourceKind(item);
  if (section === 'research') {
    return source === 'paper' || RESEARCH_LANES.has(item.lane) || realm === 'neural'
      || realm === 'behavior' || (item.lane === 'must_know' && realm === 'research');
  }
  if (section === 'engineering') {
    return source === 'repository' || ENGINEERING_LANES.has(item.lane)
      || (item.artifacts?.some((artifact) => artifact.kind === 'repository' || artifact.kind === 'release') ?? false);
  }
  if (section === 'sports') return realm === 'motion' || SPORTS_LANES.has(item.lane) || Boolean(item.sportsState);
  if (section === 'entertainment') {
    return realm === 'culture' || ENTERTAINMENT_LANES.has(item.lane)
      || source === 'game' || source === 'music';
  }
  return realm === 'nature' || item.sourceKind === 'nasa' || item.lane === 'life';
}

export function journalSectionInventory(items: FrontierItem[]): Record<JournalSectionId, number> {
  return Object.fromEntries(
    JOURNAL_SECTIONS.map((section) => [section.id, items.filter((item) =>
      journalSectionMatches(item, section.id)).length]),
  ) as Record<JournalSectionId, number>;
}
