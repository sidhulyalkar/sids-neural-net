import type { FrontierProfile } from '@/lib/frontier/types';
import { FrontierLatentCanvas } from './FrontierLatentCanvas';
import { FrontierMeasurementHealth } from './FrontierMeasurementHealth';

/**
 * Compatibility wrapper for the existing Radar route. The old lane-orbit SVG
 * has been replaced by the local vector manifold; the profile prop remains so
 * callers do not need a route-level migration.
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
