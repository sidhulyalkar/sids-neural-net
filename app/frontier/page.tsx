import type { Metadata } from 'next';
import { BackgroundCanvas } from '@/components/frontier/BackgroundCanvas';
import { FrontierExperience } from '@/components/frontier/FrontierExperience';
import { SignalTelemetryBridge } from '@/components/frontier/signals/SignalTelemetryBridge';
import { MeshStateBridge } from '@/components/frontier/sync/MeshStateBridge';
import spatial from '@/components/frontier/frontier-spatial.module.css';

export const metadata: Metadata = {
  title: 'FRONTIER · Personal Intelligence Radar',
  description: 'A live, adaptive personal radar for novel research, public code, project design, science, favorite teams, sports highlights, games, dubstep, Reddit, video, and internet culture.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Personal Intelligence Radar',
    description: 'Brainfood and After Hours in one finite daily run: studies, code, teams, games, music, community signal, and useful surprise.',
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

  return (
    <div className={spatial.root}>
      <BackgroundCanvas />
      <SignalTelemetryBridge />
      <MeshStateBridge />
      <FrontierExperience initialDateLabel={initialDateLabel} initialDayKey={initialDayKey} />
    </div>
  );
}
