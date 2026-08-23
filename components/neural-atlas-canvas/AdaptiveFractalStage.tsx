'use client';

import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalSurfaceEnhancer } from './FractalSurfaceEnhancer';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalSurfaceEnhancer />
    </>
  );
}
