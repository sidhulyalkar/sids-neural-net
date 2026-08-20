import type { Metadata } from 'next';
import { RotationExperience } from '@/components/rotation/RotationExperience';

export const metadata: Metadata = {
  title: "Sid's Rotation | Listening Fingerprint",
  description: 'My Spotify Top Items across three listening horizons — current rotation, persistent favorites, and artist gravity in an interactive neural field.',
  alternates: { canonical: '/rotation' },
};

export default function RotationPage() {
  return <RotationExperience />;
}
