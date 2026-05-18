import { NeuralGraphHome } from '@/components/neural-atlas/NeuralGraphHome';

type NeuralAtlasFallbackProps = {
  reason?: 'reduced-motion' | 'webgl-unavailable' | 'loading';
};

export function NeuralAtlasFallback({ reason }: NeuralAtlasFallbackProps) {
  if (reason === 'loading') return null;
  return <NeuralGraphHome />;
}
