import type { Metadata } from 'next';
import { FrontierFocusReader } from '@/components/frontier/FrontierFocusReader';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';

export const metadata: Metadata = {
  title: 'FRONTIER · Focus Reader',
  description: 'Read the current Frontier one original source at a time.',
  alternates: { canonical: '/frontier/read' },
};

export default function FrontierReadPage() {
  const feed = getFrontierColdSnapshotFeed();
  return <FrontierFocusReader initialItems={feed.items.slice(0, 36)} generatedAt={feed.generatedAt} />;
}
