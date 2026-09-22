'use client';

import dynamic from 'next/dynamic';
import type { FrontierProfile } from '@/lib/frontier/types';

const FrontierLatentCanvas = dynamic(
  () => import('./FrontierLatentCanvas').then((module) => module.FrontierLatentCanvas),
  { ssr: false, loading: () => null },
);

const FrontierMeasurementHealth = dynamic(
  () => import('./FrontierMeasurementHealth').then((module) => module.FrontierMeasurementHealth),
  { ssr: false, loading: () => null },
);

/**
 * Compatibility wrapper for the existing Radar route. The expensive latent
 * visualization and measurement diagnostics are separate client chunks and
 * are fetched only when the Map view is actually rendered.
 */
export function InterestConstellation({ profile }: { profile: FrontierProfile }) {
  void profile;
  return (
    <>
      <FrontierLatentCanvas />
      <FrontierMeasurementHealth />
    </>
  );
}
