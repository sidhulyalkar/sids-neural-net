import { FRONTIER_LANE_MAP } from './config';
import type { FrontierItem, FrontierLaneId } from './types';

export const FRONTIER_SECTION_PAGE_SIZE = 10;
export const FRONTIER_SECTION_FEED_PAGE_SIZE = 8;

export type FrontierSectionPage = {
  id: string;
  title: string;
  kicker: string;
  start: number;
  end: number;
  items: FrontierItem[];
};

const LAB_LANES = new Set<FrontierLaneId>([
  'ml_data',
  'ai_frontier',
  'neuro_frontier',
  'methods',
  'builder_signal',
  'broad_science',
  'competitions',
]);

const WORLD_LANES = new Set<FrontierLaneId>([
  'world_pulse',
  'premier_league',
  'world_soccer',
  'team_pulse',
  'sports',
  'life',
]);

const AFTER_HOURS_LANES = new Set<FrontierLaneId>([
  'gaming',
  'screen',
  'music',
  'internet_culture',
  'creative_tech',
  'wildcards',
]);

function dominantLane(items: FrontierItem[]): FrontierLaneId | undefined {
  const counts = new Map<FrontierLaneId, number>();
  for (const item of items) counts.set(item.lane, (counts.get(item.lane) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

function sectionTitle(index: number, items: FrontierItem[]): string {
  if (index === 0) return 'Front Page';
  const lane = dominantLane(items);
  if (!lane) return 'Dispatches';
  if (LAB_LANES.has(lane)) return 'Lab Desk';
  if (WORLD_LANES.has(lane)) return 'World & Field';
  if (AFTER_HOURS_LANES.has(lane)) return 'After Hours';
  if (lane === 'must_know') return 'Must Know';
  return FRONTIER_LANE_MAP[lane]?.shortLabel ?? 'Dispatches';
}

export function buildFrontierSectionPages(
  items: FrontierItem[],
  pageSize = FRONTIER_SECTION_PAGE_SIZE,
): FrontierSectionPage[] {
  const safePageSize = Math.max(1, Math.min(16, Math.floor(pageSize)));
  const pages: FrontierSectionPage[] = [];

  for (let start = 0; start < items.length; start += safePageSize) {
    const pageItems = items.slice(start, start + safePageSize);
    const index = pages.length;
    const end = start + pageItems.length;
    const lane = dominantLane(pageItems);
    const laneLabel = lane ? FRONTIER_LANE_MAP[lane]?.shortLabel : undefined;
    pages.push({
      id: `section-${index + 1}-${pageItems[0]?.id ?? start}`,
      title: sectionTitle(index, pageItems),
      kicker: `${start + 1}–${end} of ${items.length}${laneLabel ? ` · ${laneLabel}` : ''}`,
      start,
      end,
      items: pageItems,
    });
  }

  return pages;
}
