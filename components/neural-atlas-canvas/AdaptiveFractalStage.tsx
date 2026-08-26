'use client';

import { FractalThemeRecorder } from '@/components/neural-atlas/FractalThemeEcho';
import { AdaptiveFractalHome as AdaptiveFractalHomeBase } from './AdaptiveFractalHome';
import { FractalCrispTopologyV13 } from './FractalCrispTopologyV13';
import { FractalExperienceV3 } from './FractalExperienceV3';
import { FractalInteriorDensityV17 } from './FractalInteriorDensityV17';
import { FractalPublicCurationV14 } from './FractalPublicCurationV14';
import { FractalResponsiveEnvelopeV16 } from './FractalResponsiveEnvelopeV16';
import { FractalSurfaceEnhancerV2 } from './FractalSurfaceEnhancerV2';

export function AdaptiveFractalStage() {
  return (
    <>
      <AdaptiveFractalHomeBase />
      <FractalCrispTopologyV13 />
      <FractalSurfaceEnhancerV2 />
      <FractalExperienceV3 />
      <FractalPublicCurationV14 />
      <FractalResponsiveEnvelopeV16 />
      <FractalInteriorDensityV17 />
      <FractalThemeRecorder />
    </>
  );
}
