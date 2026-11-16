import type { Metadata } from 'next';
import { FrontierFocusReader } from '@/components/frontier/FrontierFocusReader';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';

export const metadata: Metadata = {
  title: 'FRONTIER · Research Journal',
  description: 'A thoughtfully edited journal of emerging research, code, culture and discoveries, grounded in original sources.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Research Journal',
    description: 'An immersive research journal for curious minds.',
    url: '/frontier',
    type: 'website',
  },
};

/**
 * Do not import the animated radar, streaming daemon, canvas, WebGL media, or
 * client-side live source mesh into the default route. A validated snapshot is
 * already available locally at build time, so the first story server-renders.
 */
export default function FrontierPage() {
  const feed = getFrontierColdSnapshotFeed();
  return <FrontierFocusReader initialItems={feed.items.slice(0, 36)} generatedAt={feed.generatedAt} />;
}
