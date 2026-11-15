import { Metadata } from 'next';
import Link from 'next/link';
import {galleryWorldHref} from '@/lib/world/galleryLinks';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';
import { PublicationFocusArchive } from '@/components/publications/PublicationFocusArchive';
import { getOpenAlexPublicationEnhancements } from '@/lib/openalex';

export const metadata: Metadata = {
  title: 'Paper Archive',
  description:
    'Peer-reviewed publications by Sidharth Hulyalkar in neuroscience, neural engineering, behavioral systems, and computational methods.',
  alternates: {
    canonical: '/publications',
  },
  openGraph: {
    title: 'Paper Archive | Sids Neural Net',
    description: 'Peer-reviewed neuroscience and computational methods publications.',
    url: '/publications',
  },
};

export default async function PublicationsPage() {
  const graph = NeuralGraphSchema.parse(graphData);

  // Filter for publications only and sort by year
  const publications = graph.nodes
    .filter((n) => n.type === 'publication')
    .sort((a, b) => {
      const yearA = a.publication?.year || 0;
      const yearB = b.publication?.year || 0;
      return yearB - yearA;
    });
  const enhancements = await getOpenAlexPublicationEnhancements(publications);

  return (
    <ComicSectionLayout
      eyebrow="archive"
      title="paper archive"
    >
      <div className="max-w-6xl">
        {/* Publications List */}
        {publications.length > 0 ? (
          <PublicationFocusArchive publications={publications} enhancements={enhancements} />
        ) : (
          <NodeDetailPanel label="Archive Empty" title="Publication data will be populated from the data layer." tone="violet">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet/20 flex items-center justify-center">
                <svg className="h-8 w-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </NodeDetailPanel>
        )}
      </div>
      <nav aria-label="Visit paper museum in Sid's iLand" className="mt-16 border-t border-white/15 pt-7">
        <Link href={galleryWorldHref("papers")} prefetch={false}
          className="group inline-flex min-h-11 items-center gap-3 text-sm text-text-secondary transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
          <span aria-hidden="true" className="text-lg text-violet/80">◇</span>
          Enter the hidden waterfall research museum in Sid’s iLand
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
        </Link>
      </nav>
    </ComicSectionLayout>
  );
}
