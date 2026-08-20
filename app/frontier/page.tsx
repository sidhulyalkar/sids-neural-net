import type { Metadata } from 'next';
import { FrontierExperience } from '@/components/frontier/FrontierExperience';

export const metadata: Metadata = {
  title: 'FRONTIER · Personal Intelligence Radar',
  description: 'A live, adaptive personal intelligence feed for Premier League football, machine learning, data analysis, neuroscience, science, tools, and useful surprise.',
  alternates: { canonical: '/frontier' },
  openGraph: {
    title: 'FRONTIER · Personal Intelligence Radar',
    description: 'A finite daily run across the live internet that learns what is useful, important, surprising, and already known.',
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

  return <FrontierExperience initialDateLabel={initialDateLabel} initialDayKey={initialDayKey} />;
}
