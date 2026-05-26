import { Metadata } from 'next';
import IdeasClient from './IdeasClient';

export const metadata: Metadata = {
  title: 'Research Ideas',
  description: 'Research directions in neural search, foundation models for brain dynamics, mechanistic interpretability, BCI infrastructure, and scientific tools.',
  alternates: {
    canonical: '/ideas',
  },
  openGraph: {
    title: 'Research Ideas | Sids Neural Net',
    description: 'Research sketches around brain dynamics, interpretability, BCI, and scientific tools.',
    url: '/ideas',
  },
};

export default function IdeasPage() {
  return <IdeasClient />;
}
