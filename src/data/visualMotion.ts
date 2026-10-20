export type VisualMotionSource = {
  src: string;
  type: 'video/mp4' | 'video/webm' | 'application/vnd.apple.mpegurl';
  label: string;
  width?: number;
  height?: number;
  bitrateMbps?: number;
};

export type WildlifeSubject = 'turtle' | 'shark' | 'manta' | 'ray' | 'reef-fish';

/** Optional discovery binding: published footage only, never a placeholder. */
export type MotionEncounter =
  | { activity: 'snorkeling'; animal: WildlifeSubject; reef: 'lagoon' | 'kelp' }
  | { activity: 'ski' | 'dirt-bike' };

export type VisualMotionEntry = {
  id: string;
  title: string;
  description?: string;
  posterSrc: string;
  alt: string;
  durationSeconds: number;
  aspectRatio: `${number} / ${number}`;
  capturedWith?: string;
  location?: string;
  date?: string;
  tags?: string[];
  featured?: boolean;
  encounter?: MotionEncounter;
  sources: VisualMotionSource[];
};

/**
 * Curated motion records for the Visual Cortex.
 *
 * Keep this manifest explicit rather than crawling public assets during builds.
 * Source videos should be prepared outside the Next build with
 * scripts/prepare-visual-motion.py, then committed or uploaded to the chosen
 * media origin and referenced here. No footage is invented or auto-published.
 * A published snorkeling clip may opt into a nearby creature interaction via:
 * encounter: { activity: 'snorkeling', animal: 'turtle', reef: 'lagoon' }
 * The same manifest can later catalog ski and dirt-bike action clips.
 */
export const visualMotion: VisualMotionEntry[] = [];
