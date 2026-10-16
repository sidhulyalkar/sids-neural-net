import type { World3DBudget } from './types';

/**
 * World Loom physical and performance standards.
 *
 * One Three.js world unit is always one meter. These values are deliberately
 * centralized so generated worlds, authored hero scenes, desktop previews and
 * WebXR all share the same spatial assumptions.
 */
export const WORLD3D_STANDARDS = {
  unitsPerMeter: 1,
  avatarHeight: 1.68,
  eyeHeight: 1.6,
  seatedEyeHeight: 1.2,
  spawnClearRadius: 1.5,
  minimumWalkableWidth: 1.25,
  preferredWalkableWidth: 1.8,
  minimumHeadClearance: 2.15,
  maximumStepHeight: 0.22,
  maximumWalkSlopeDegrees: 28,
  minimumInteractionHeight: 0.35,
  maximumInteractionHeight: 1.7,
  preferredInteractionDistance: 1.25,
  maximumInteractionDistance: 2.2,
  minimumComfortRadius: 2.5,
  defaultWorldRadius: 11,
  minimumWorldRadius: 7,
  maximumWorldRadius: 18,
  defaultLandmarkDistance: 6.5,
  minimumLandmarkDistance: 4.5,
  maximumLandmarkDistance: 12,
  maximumVerticalTraversalPerStep: 0.2,
  xrNearClip: 0.05,
  desktopNearClip: 0.1,
  farClipPadding: 18,
  targetDesktopFps: 60,
  targetXrFps: 72,
  maximumDynamicLights: 3,
  maximumTransparentLayers: 4,
} as const;

export const WORLD3D_BUDGETS: Record<'mobile' | 'desktop' | 'xr', World3DBudget> = {
  mobile: {
    maxDrawCalls: 80,
    maxVisibleTriangles: 120_000,
    maxInstances: 900,
    maxDynamicLights: 2,
    maxParticles: 220,
  },
  desktop: {
    maxDrawCalls: 120,
    maxVisibleTriangles: 260_000,
    maxInstances: 1_800,
    maxDynamicLights: 3,
    maxParticles: 420,
  },
  xr: {
    maxDrawCalls: 90,
    maxVisibleTriangles: 180_000,
    maxInstances: 1_250,
    maxDynamicLights: 2,
    maxParticles: 280,
  },
};

export const WORLD3D_QUALITY_RULES = {
  /** Keep the player spawn visually and physically quiet. */
  spawnExclusionRadius: WORLD3D_STANDARDS.spawnClearRadius,
  /** Landmark must be readable from spawn in a typical pocket world. */
  landmarkSilhouetteMinHeight: 1.8,
  landmarkSilhouettePreferredHeight: 3.2,
  /** Repeated scenery should be instanced rather than individual React meshes. */
  instanceThreshold: 4,
  /** Keep world-law animation amplitude subtle enough to avoid discomfort in XR. */
  maximumWorldMotionMeters: 0.16,
  maximumWorldRotationRadians: 0.06,
  /** No generated route should depend on jumping in the base experience. */
  jumpingRequired: false,
  /** The player should always have a stable visual horizon or local reference. */
  stableReferenceRequired: true,
} as const;