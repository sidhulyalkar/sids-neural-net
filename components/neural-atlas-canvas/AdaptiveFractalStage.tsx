'use client';

import { FractalThemeRecorder } from '@/components/neural-atlas/FractalThemeEcho';
import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalCrispTopologyV13 } from './FractalCrispTopologyV13';
import { FractalSurfaceEnhancerV2 } from './FractalSurfaceEnhancerV2';
import { FractalExperienceV3 } from './FractalExperienceV3';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalCrispTopologyV13 />
      <FractalSurfaceEnhancerV2 />
      <FractalExperienceV3 />
      <FractalThemeRecorder />
    </>
  );
}
