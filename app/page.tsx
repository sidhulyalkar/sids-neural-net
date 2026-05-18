import dynamic from 'next/dynamic';
import { NeuralAtlasLoading } from '@/components/neural-atlas-3d';

const NeuralAtlasExperience = dynamic(
  () => import('@/components/neural-atlas-3d').then((module) => module.NeuralAtlasExperience),
  {
    loading: () => <NeuralAtlasLoading />,
  }
);

export default function HomePage() {
  return <NeuralAtlasExperience />;
}
