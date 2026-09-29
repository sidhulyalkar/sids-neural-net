'use client';

import { usePathname } from 'next/navigation';
import { FractalThemeEcho } from './FractalThemeEcho';
import { NeuralBackground } from './NeuralBackground';

export function ThemedNeuralBackground() {
  const pathname = usePathname();
  const showFractalThemeEcho = pathname !== '/';

  return (
    <>
      <NeuralBackground />
      {showFractalThemeEcho ? <FractalThemeEcho variant="background" /> : null}
    </>
  );
}
