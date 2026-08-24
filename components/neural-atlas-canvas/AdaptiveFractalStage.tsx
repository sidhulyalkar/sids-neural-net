'use client';

import { FractalThemeRecorder } from '@/components/neural-atlas/FractalThemeEcho';
import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalSurfaceEnhancerV2 } from './FractalSurfaceEnhancerV2';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalSurfaceEnhancerV2 />
      <FractalThemeRecorder />
    </>
  );
}
