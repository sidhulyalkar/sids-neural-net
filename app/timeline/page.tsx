import { Metadata } from 'next';
import { loadTimelineEvents } from '@/lib/content/load-timeline';
import { SignalTimeline } from '@/components/timeline';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'A chronological journey through career milestones, research, builds, and publications.',
  alternates: {
    canonical: '/timeline',
  },
  openGraph: {
    title: 'Timeline | Sids Neural Net',
    description: 'A chronological signal trace through career, research, project, publication, and life events.',
    url: '/timeline',
  },
};

export default function TimelinePage() {
  const events = loadTimelineEvents();

  return (
    <ComicSectionLayout
      eyebrow="signal trace"
      title="timeline"
    >
      <div className="max-w-4xl">
        <SignalTimeline events={events} />
      </div>
    </ComicSectionLayout>
  );
}
