import type { Metadata } from 'next';
import { FrontierSectionExperience } from '@/components/frontier/FrontierSectionExperience';
import { getFrontierColdSnapshotFeed } from '@/lib/frontier/snapshotFeed';
import spatial from '@/components/frontier/frontier-spatial.module.css';
import './frontier-render-fast.css';

export const metadata: Metadata = {
  title: 'FRONTIER · Personal Intelligence Radar',
  description: 'A fast, adaptive personal radar for research, public code, project design, science, sports, games, music, video, and useful surprise.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Personal Intelligence Radar',
    description: 'A finite daily edition of studies, code, teams, games, music, community signal, and useful surprise.',
    url: '/frontier',
    type: 'website',
  },
};

export default function FrontierPage() {
  const now = new Date();
  const initialDateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);
  const initialDayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const snapshot = getFrontierColdSnapshotFeed(now.getTime());
  const initialFeed = {
    generatedAt: snapshot.generatedAt,
    items: snapshot.items.slice(0, 40),
    sources: snapshot.sources,
  };

  return (
    <div
      className={spatial.root}
      data-frontier-performance-route="true"
      data-frontier-data-authority="server-snapshot"
      data-frontier-passive-discovery="off"
    >
      <FrontierSectionExperience
        initialDateLabel={initialDateLabel}
        initialDayKey={initialDayKey}
        initialFeed={initialFeed}
      />
    </div>
  );
}
