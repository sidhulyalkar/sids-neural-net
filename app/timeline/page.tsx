import { Metadata } from 'next';
import { loadTimelineEvents } from '@/lib/content/load-timeline';
import { SignalTimeline } from '@/components/timeline';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'A chronological journey through career milestones, research, projects, and publications.',
};

export default function TimelinePage() {
  const events = loadTimelineEvents();

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className="technical-label">Signal Trace</p>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-text-primary md:text-7xl">Timeline</h1>
          <p className="mt-4 text-lg text-text-secondary">
            A chronological signal trace through {events.length} career, research, project, publication, and life events.
          </p>
        </div>

        {/* Signal visualization hint */}
        <div className="neural-panel neural-panel-cut mb-8 p-4">
          <p className="text-sm text-text-muted">
            Each event is weighted like a signal peak. Filter by category to isolate career, research, project, publication, or life channels.
          </p>
        </div>

        {/* Timeline */}
        <SignalTimeline events={events} />

        {/* Footer note */}
        <div className="mt-12 text-center text-sm text-text-muted">
          <p>
            The timeline continues to grow with new research, projects, and milestones.
          </p>
        </div>
      </div>
    </div>
  );
}
