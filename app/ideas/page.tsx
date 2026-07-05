import { Metadata } from 'next';
import IdeasClient from './IdeasClient';

export const metadata: Metadata = {
  title: 'Research Ideas',
  description: 'Research directions in neural dynamics of inhibition, dataset reuse, source-level neural data augmentation, quantum BCI, and large-scale scientific systems.',
  alternates: {
    canonical: '/ideas',
  },
  openGraph: {
    title: 'Research Ideas | Sids Neural Net',
    description: 'Research sketches around neural dynamics, dataset reinterpretation, quantum BCI, and systems for scientific discovery.',
    url: '/ideas',
  },
};

export default function IdeasPage() {
  return <IdeasClient />;
}
