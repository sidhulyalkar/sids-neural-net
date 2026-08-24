'use client';

import { FractalThemeRecorder } from '@/components/neural-atlas/FractalThemeEcho';
import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalSurfaceEnhancerV2 } from './FractalSurfaceEnhancerV2';
import { FractalExperienceV3 } from './FractalExperienceV3';
import { FractalNavigationClearanceV4 } from './FractalNavigationClearanceV4';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalSurfaceEnhancerV2 />
      <FractalExperienceV3 />
      <FractalNavigationClearanceV4 />
      <FractalThemeRecorder />
    </>
  );
}
