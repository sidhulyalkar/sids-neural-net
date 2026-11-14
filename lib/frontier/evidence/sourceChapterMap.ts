import type { StoryManifest } from './schema';

/**
 * Only original publisher section headings. This is a navigation aid, not a
 * source interpretation or generated paper summary.
 */
export type SourceSection = {
  id: string;
  title: string;
  sourceUrl: string;
  sectionId: string;
  figureIds: string[];
};

export type SourceChapter = {
  id: 'context' | 'methods' | 'results' | 'limitations' | 'other';
  label: string;
  shortLabel: string;
  sections: SourceSection[];
};

type ChapterId = SourceChapter['id'];

const meta: Record<ChapterId, { label: string; shortLabel: string }> = {
  context: { label: 'Question & context', shortLabel: 'Context' },
  methods: { label: 'Methods & approach', shortLabel: 'Methods' },
  results: { label: 'Results & analysis', shortLabel: 'Evidence' },
  limitations: { label: 'Discussion & limitations', shortLabel: 'Limitations' },
  other: { label: 'Additional source sections', shortLabel: 'More' },
};

function groupFor(title: string): ChapterId {
  const heading = title.replace(/^(?:[A-Z]|\d+(?:\.\d+)*)(?:\s+|[.:]\s*)/, '').trim();
  // Order is meaningful: "Experiment Design" must not become "Results".
  if (/\b(?:limitations?|future work|discussion|conclusions?|caveats?)\b/i.test(heading)) return 'limitations';
  if (/\b(?:methods?|methodology|problem setup|experiment(?:al)? design|approach|implementation|dataset description|data collection|design space|procedures?)\b/i.test(heading)) return 'methods';
  if (/\b(?:results?|analysis|evaluation|benchmarks?|ablation|findings|comparisons?)\b/i.test(heading)) return 'results';
  if (/\b(?:introductions?|background|motivation|research questions?|related work|overview)\b/i.test(heading)) return 'context';
  return 'other';
}

export function sourceChapterMap(manifest: StoryManifest): SourceChapter[] {
  const figures = manifest.evidence.filter((evidence) =>
    evidence.type === 'figure' && evidence.rights.display === 'permitted');
  const groups = new Map<ChapterId, SourceSection[]>();

  for (const evidence of manifest.evidence) {
    if (evidence.type !== 'quotation' || evidence.role !== 'section-heading'
      || evidence.status !== 'publisher-reported' || !evidence.locator.section) continue;
    // Every record is already checked against the canonical publisher and
    // revision by parseQualifiedStoryManifest at the story boundary.
    const sectionId = evidence.locator.section;
    const group = groupFor(evidence.text);
    const bucket = groups.get(group) || [];
    if (bucket.some((section) => section.sectionId === sectionId)) continue;
    bucket.push({
      id: evidence.id,
      sectionId,
      title: evidence.text,
      sourceUrl: evidence.locator.sourceUrl,
      figureIds: figures
        .filter((figure) => figure.locator.section === sectionId)
        .map((figure) => figure.id),
    });
    groups.set(group, bucket);
  }

  return (['context', 'methods', 'results', 'limitations', 'other'] as const)
    .filter((id) => groups.has(id))
    .map((id) => ({
      id,
      label: meta[id].label,
      shortLabel: meta[id].shortLabel,
      sections: (groups.get(id) || []).slice(0, id === 'other' ? 5 : 6),
    }));
}
