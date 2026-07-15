import type { Metadata } from 'next';
import { PerceptualCortexExperience } from '@/components/perceptual-cortex/PerceptualCortexExperience';

export const metadata: Metadata = {
  title: 'Perceptual Cortex',
  description: 'A living neural artwork shaped by movement, touch, and rhythm.',
  alternates: { canonical: '/perceptual-cortex' },
};

export default function PerceptualCortexPage() {
  return <PerceptualCortexExperience />;
}

