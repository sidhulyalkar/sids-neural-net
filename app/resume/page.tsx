import type { Metadata } from 'next';
import ResumeClient from './ResumeClient';

export const metadata: Metadata = {
  title: 'Resume',
  description:
    'Current resume for Sidharth Hulyalkar: neuroscience data infrastructure, multimodal ML, BCI systems, applied AI, and scientific software.',
  alternates: {
    canonical: '/resume',
  },
  openGraph: {
    title: 'Resume | Sids Neural Net',
    description: 'Current resume for Sidharth Hulyalkar.',
    url: '/resume',
  },
};

export default function ResumePage() {
  return <ResumeClient />;
}

