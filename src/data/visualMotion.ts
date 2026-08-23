export type VisualMotionSource = {
  src: string;
  type: 'video/mp4' | 'video/webm' | 'application/vnd.apple.mpegurl';
  label: string;
  width?: number;
  height?: number;
  bitrateMbps?: number;
};

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
  sources: VisualMotionSource[];
};

/**
 * Curated motion records for the Visual Cortex.
 *
 * Keep this manifest explicit rather than crawling public assets during builds.
 * Source videos should be prepared outside the Next build with
 * scripts/prepare-visual-motion.py, then committed or uploaded to the chosen
 * media origin and referenced here. No footage is invented or auto-published.
 */
export const visualMotion: VisualMotionEntry[] = [];
