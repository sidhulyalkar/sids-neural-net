'use client';

import { FractalThemeRecorder } from '@/components/neural-atlas/FractalThemeEcho';
import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalSurfaceEnhancerV2 } from './FractalSurfaceEnhancerV2';
import { FractalExperienceV3 } from './FractalExperienceV3';
import { FractalCoreNucleusV10 } from './FractalCoreNucleusV10';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalSurfaceEnhancerV2 />
      <FractalExperienceV3 />
      <FractalCoreNucleusV10 />
      <FractalThemeRecorder />
    </>
  );
}
