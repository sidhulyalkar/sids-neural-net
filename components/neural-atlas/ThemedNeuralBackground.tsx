import { FractalThemeEcho } from './FractalThemeEcho';
import { NeuralBackground } from './NeuralBackground';

export function ThemedNeuralBackground() {
  return (
    <>
      <NeuralBackground />
      <FractalThemeEcho variant="background" />
    </>
  );
}
