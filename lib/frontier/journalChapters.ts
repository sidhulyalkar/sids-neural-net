import type { FrontierItem } from './types';
import { journalMeasuredMetrics } from './journalPresentation';

export type JournalChapter = {
  id: 'frontier-story-summary' | 'frontier-story-media' | 'frontier-story-figure' | 'frontier-evidence' | 'frontier-story-source';
  label: string;
  shortLabel: string;
};

export function journalChapters(
  item: FrontierItem,
  options: { hasSourceVideo: boolean; hasSourceFigure: boolean },
): JournalChapter[] {
  const chapters: JournalChapter[] = [
    { id: 'frontier-story-summary', label: 'Understand the story', shortLabel: 'Understand' },
  ];
  if (options.hasSourceVideo) {
    chapters.push({ id: 'frontier-story-media', label: 'Watch the original', shortLabel: 'Watch' });
  }
  if (options.hasSourceFigure) {
    chapters.push({ id: 'frontier-story-figure', label: 'Inspect an original figure', shortLabel: 'Figures' });
  }
  if (item.sportsState || journalMeasuredMetrics(item).length || item.artifacts?.length || item.convergence?.members.length) {
    chapters.push({ id: 'frontier-evidence', label: 'Inspect reported evidence', shortLabel: 'Evidence' });
  }
  chapters.push({ id: 'frontier-story-source', label: 'Trace the original source', shortLabel: 'Source' });
  return chapters;
}
