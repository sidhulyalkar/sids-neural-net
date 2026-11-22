import type { Metadata } from 'next';
import { FrontierFocusReader } from '@/components/frontier/FrontierFocusReader';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';
import { selectFrontierColdEdition } from '@/lib/frontier/coldEdition';

export const metadata: Metadata = {
  title: 'FRONTIER · Focus Reader',
  description: 'One story at a time. A faster daily reader for research, code, sports, games, and discoveries worth understanding.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Focus Reader',
    description: 'A calmer, focused personal discovery reader.',
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
  // Qualify the FULL archived inventory before building the first edition.
  // Cutting to 36 by provider score first would permanently hide highly
  // relevant niche neuroscience/research candidates from cold-start readers.
  const edition = selectFrontierColdEdition(feed.items, 36);
  return <FrontierFocusReader initialItems={edition} generatedAt={feed.generatedAt} />;
}
