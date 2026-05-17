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
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Timeline</h1>
          <p className="mt-2 text-lg text-text-secondary">
            A chronological journey through {events.length} career milestones, research, projects, and publications.
          </p>
        </div>

        {/* Signal visualization hint */}
        <div className="mb-8 p-4 bg-bg-panel/50 border border-border-subtle rounded-lg">
          <p className="text-sm text-text-muted">
            Each event is weighted by importance. Filter by category to focus on specific areas of the journey.
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
