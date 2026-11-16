import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FrontierEvidenceStory } from '@/components/frontier/evidence/FrontierEvidenceStory';
import { getPublishedStory } from '@/lib/frontier/evidence/publishedStory';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';
import type { PublishedStory } from '@/lib/frontier/evidence/publishedStory';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** The story reader never invents a display title from an ID. Its first choice
 * is the already published editorial item; source identity is the fallback. */
function displayText(story: PublishedStory) {
  if (story.editorial) {
    // A reviewed title and context survive ten-day snapshot expiry.
    return { title: story.editorial.title, summary: story.editorial.lead };
  }
  const entry = getFrontierColdSnapshotFeed().items.find((item) =>
    item.id === story.manifest.itemId && item.url === story.manifest.source.url);
  return {
    title: entry?.title || story.manifest.source.publisher + ' · ' + story.manifest.source.revision,
    summary: entry?.summary,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await getPublishedStory(id);
  if (!story) return { title: 'Research story unavailable · FRONTIER', robots: { index: false } };
  const { title, summary } = displayText(story);
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
  const { title, summary } = displayText(story);
  return <FrontierEvidenceStory manifest={story.manifest} assets={story.assetPaths}
    title={title} summary={summary} editorial={story.editorial}/>;
}
