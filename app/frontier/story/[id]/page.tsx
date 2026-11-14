import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FrontierEvidenceStory } from '@/components/frontier/evidence/FrontierEvidenceStory';
import { getPublishedStory } from '@/lib/frontier/evidence/publishedStory';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** The story reader never invents a display title from an ID. Its first choice
 * is the already published editorial item; source identity is the fallback. */
function displayText(id: string, publisher: string, revision: string) {
  const entry = getFrontierColdSnapshotFeed().items.find((item) => item.id === id);
  return {
    title: entry?.title || publisher + ' · ' + revision,
    summary: entry?.summary,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await getPublishedStory(id);
  if (!story) return { title: 'Research story unavailable · FRONTIER', robots: { index: false } };
  const { title, summary } = displayText(id, story.manifest.source.publisher, story.manifest.source.revision);
  return {
    title: title + ' · FRONTIER Research',
    description: summary || 'Explore source-grounded evidence and original research figures.',
    robots: { index: false, follow: true },
  };
}

export default async function PublishedFrontierStory({ params }: Props) {
  const { id } = await params;
  const story = await getPublishedStory(id);
  if (!story) notFound();
  const { title, summary } = displayText(id, story.manifest.source.publisher, story.manifest.source.revision);
  return <FrontierEvidenceStory manifest={story.manifest} assets={story.assetPaths}
    title={title} summary={summary}/>;
}
