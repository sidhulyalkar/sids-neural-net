import type { Metadata } from 'next';
import { RotationExperience } from '@/components/rotation/RotationExperience';

export const metadata: Metadata = {
  title: "Sid's Rotation",
  description: 'A gesture-reactive visualizer for my Spotify rotation — the neural organism moves to the beat and to you.',
  alternates: { canonical: '/rotation' },
};

export default function RotationPage() {
  return <RotationExperience />;
}
