import type { FrontierItem, FrontierMedia } from '../types';

export type FrontierMediaGeometry = {
  aspectRatio: number;
  cssAspectRatio: string;
  label: NonNullable<FrontierMedia['aspectRatio']>;
};

const RATIO_BY_LABEL: Record<NonNullable<FrontierMedia['aspectRatio']>, number> = {
  square: 1,
  portrait: 3 / 4,
  landscape: 4 / 3,
  wide: 16 / 9,
};

const MIN_RATIO = 1 / 2;
const MAX_RATIO = 12 / 5;

function positiveDimension(value?: number): value is number {
  return Number.isFinite(value) && Boolean(value && value > 0);
}

function clampRatio(value: number): number {
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, value));
}

function closestRatioLabel(value: number): NonNullable<FrontierMedia['aspectRatio']> {
  const ratio = clampRatio(value);
  return (Object.entries(RATIO_BY_LABEL) as Array<[NonNullable<FrontierMedia['aspectRatio']>, number]>)
    .sort((left, right) => Math.abs(left[1] - ratio) - Math.abs(right[1] - ratio))[0]?.[0] ?? 'square';
}

export function frontierDefaultMediaAspectRatio(media?: FrontierMedia): NonNullable<FrontierMedia['aspectRatio']> {
  if (media?.type === 'video' || media?.type === 'youtube') return 'wide';
  return 'square';
}

export function frontierMediaGeometry(media?: FrontierMedia): FrontierMediaGeometry {
  if (media && positiveDimension(media.width) && positiveDimension(media.height)) {
    const rawAspectRatio = media.width / media.height;
    const aspectRatio = clampRatio(rawAspectRatio);
    return {
      aspectRatio,
      cssAspectRatio: rawAspectRatio === aspectRatio
        ? `${media.width} / ${media.height}`
        : `${aspectRatio} / 1`,
      label: media.aspectRatio ?? closestRatioLabel(aspectRatio),
    };
  }

  const label = media?.aspectRatio ?? frontierDefaultMediaAspectRatio(media);
  const aspectRatio = RATIO_BY_LABEL[label];
  const cssAspectRatio = label === 'square'
    ? '1 / 1'
    : label === 'portrait'
      ? '3 / 4'
      : label === 'landscape'
        ? '4 / 3'
        : '16 / 9';
  return { aspectRatio, cssAspectRatio, label };
}

/**
 * Every renderable source visual receives a deterministic expected geometry
 * before it enters the presentation pool. Exact source dimensions remain the
 * strongest signal; the categorical ratio is a stable fallback only.
 */
export function enrichFrontierMediaGeometry(item: FrontierItem): FrontierItem {
  const media = item.media;
  if (!media || media.type === 'none' || media.type === 'chart') return item;
  if (media.aspectRatio) return item;
  const geometry = frontierMediaGeometry(media);
  return { ...item, media: { ...media, aspectRatio: geometry.label } };
}
