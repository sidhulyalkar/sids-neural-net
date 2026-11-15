import type { FrontierItem } from './types';
import { journalMeasuredMetrics } from './journalPresentation';
import type { JournalFormat } from './journalPresentation';

export type JournalChapter = {
  id: 'frontier-story-summary' | 'frontier-story-media' | 'frontier-story-figure' | 'frontier-evidence' | 'frontier-story-source';
  label: string;
  shortLabel: string;
};

/** Match the actual visible order of the source format: an authentic image,
 * live result, or original clip can precede the story summary. Never create an
 * index step for an absent figure, recording, or reported evidence. */
export function journalChapters(
  item: FrontierItem,
  options: { hasSourceVideo: boolean; hasSourceFigure: boolean; format?: JournalFormat },
): JournalChapter[] {
  const summary: JournalChapter = {
    id: 'frontier-story-summary', label: 'Understand the story', shortLabel: 'Understand',
  };
  const media: JournalChapter = {
    id: 'frontier-story-media', label: 'Watch the original', shortLabel: 'Watch',
  };
  const figure: JournalChapter = {
    id: 'frontier-story-figure', label: 'Inspect an original figure', shortLabel: 'Figures',
  };
  const evidence: JournalChapter = {
    id: 'frontier-evidence', label: 'Inspect reported evidence', shortLabel: 'Evidence',
  };
  const source: JournalChapter = {
    id: 'frontier-story-source', label: 'Trace the original source', shortLabel: 'Source',
  };
  const hasEvidence = Boolean(item.sportsState || journalMeasuredMetrics(item).length
    || item.artifacts?.length || item.convergence?.members.length);
  const evidenceFirst = hasEvidence && (options.format === 'live' || options.format === 'measured');
  const figureFirst = options.hasSourceFigure && options.format === 'visual';
  const mediaFirst = options.hasSourceVideo && options.format === 'watch';

  const chapters: JournalChapter[] = [];
  if (evidenceFirst) chapters.push(evidence);
  if (figureFirst) chapters.push(figure);
  if (mediaFirst) chapters.push(media);
  chapters.push(summary);
  if (options.hasSourceVideo && !mediaFirst) chapters.push(media);
  if (options.hasSourceFigure && !figureFirst) chapters.push(figure);
  if (hasEvidence && !evidenceFirst) chapters.push(evidence);
  chapters.push(source);
  return chapters;
}
