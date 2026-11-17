import type { Metadata } from 'next';
import { FrontierEditionFeed } from '@/components/frontier/FrontierEditionFeed';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';

export const metadata: Metadata = {
  title: 'FRONTIER · Living Edition',
  description: 'A continuously evolving, source-grounded edition of research, engineering, sport, media and meaningful discoveries.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Living Edition',
    description: 'A field guide to ideas worth understanding, with source-rich discovery and personal interest signals.',
    url: '/frontier', type: 'website',
  },
};

/** Default experience: multiple independently navigable source articles.
 * Preserve the single-story reader at /frontier/read and the full advanced
 * radar at /frontier/advanced. Cold navigation never starts the live mesh.
 */
export default function FrontierPage() {
  const feed = getFrontierColdSnapshotFeed();
  return <FrontierEditionFeed initialItems={feed.items.slice(0, 36)} generatedAt={feed.generatedAt} />;
}
