import type { FrontierItem } from '../types';

export type FrontierVisualRole = 'hero' | 'wide' | 'visual' | 'standard' | 'compact';

const VISUAL_MEDIA_TYPES = new Set(['image', 'video', 'youtube']);

export function frontierHasPresentationMedia(item: FrontierItem): boolean {
  return Boolean(item.media && VISUAL_MEDIA_TYPES.has(item.media.type));
}

export function frontierVisualRole(
  item: FrontierItem,
  index: number,
  hasRenderableMedia = frontierHasPresentationMedia(item),
): FrontierVisualRole {
  if (hasRenderableMedia) {
    if (item.highPriority || item.media?.type === 'video' || item.media?.type === 'youtube') return 'hero';
    if (item.importance >= 0.8 || index % 7 === 0) return 'wide';
    return 'visual';
  }

  if (item.metrics?.length || item.artifacts?.length || item.convergence) return 'standard';
  return 'compact';
}

export function frontierMasonrySpan(
  contentHeight: number,
  rowHeight = 8,
  rowGap = 10,
): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return 1;
  const unit = Math.max(1, rowHeight) + Math.max(0, rowGap);
  return Math.max(1, Math.ceil((contentHeight + Math.max(0, rowGap)) / unit));
}
