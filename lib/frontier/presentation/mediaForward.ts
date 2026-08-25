import type { FrontierItem } from '../types';

export type FrontierVisualRole = 'hero' | 'wide' | 'visual' | 'standard' | 'compact';
export type FrontierPackedSpan = 4 | 8;

const VISUAL_MEDIA_TYPES = new Set(['image', 'video', 'youtube']);
const DESKTOP_COLUMNS = 12;

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

    // Card size is presentation only, but it still controls visual attention.
    // Never promote an arbitrary image merely because it landed at index 0/7/14.
    // Wide treatment is reserved for intrinsically important signals or a very
    // high-quality signal already ranked near the top by the recommendation
    // engine. Media presence itself can never purchase either condition.
    if (item.importance >= 0.82) return 'wide';
    if (index < 6 && item.importance >= 0.74 && item.quality >= 0.86) return 'wide';
    return 'visual';
  }

  if (item.metrics?.length || item.artifacts?.length || item.convergence) return 'standard';
  return 'compact';
}

/**
 * Build an order-preserving desktop packing plan. We intentionally do not use
 * CSS grid-auto-flow:dense because dense backfill can paint lower-ranked cards
 * above higher-ranked ones. 4/8-column units can fill every complete 12-column
 * row while still giving strong media an editorially larger footprint.
 */
export function frontierPackedColumnSpans(
  items: FrontierItem[],
  renderableMedia: boolean[] = items.map(frontierHasPresentationMedia),
): FrontierPackedSpan[] {
  let remaining = DESKTOP_COLUMNS;
  return items.map((item, index) => {
    const hasMedia = renderableMedia[index] ?? frontierHasPresentationMedia(item);
    const role = frontierVisualRole(item, index, hasMedia);
    const preferred: FrontierPackedSpan = hasMedia && (role === 'hero' || role === 'wide') ? 8 : 4;
    const span: FrontierPackedSpan = preferred <= remaining ? preferred : 4;
    remaining -= span;
    if (remaining === 0) remaining = DESKTOP_COLUMNS;
    return span;
  });
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
