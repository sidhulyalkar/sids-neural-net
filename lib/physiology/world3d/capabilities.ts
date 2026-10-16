export type WorldLoomCapabilities = {
  webgl: boolean;
  webxr: boolean;
  immersiveVr: boolean | null;
  handTrackingHint: boolean;
};

type XrLike = {
  isSessionSupported?: (mode: 'immersive-vr') => Promise<boolean>;
};

type NavigatorWithXr = Navigator & { xr?: XrLike };

export async function detectWorldLoomCapabilities(): Promise<WorldLoomCapabilities> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { webgl: false, webxr: false, immersiveVr: null, handTrackingHint: false };
  }

  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webgl = false;
  }

  const xr = (navigator as NavigatorWithXr).xr;
  const webxr = Boolean(xr);
  let immersiveVr: boolean | null = null;
  if (xr?.isSessionSupported) {
    try {
      immersiveVr = await xr.isSessionSupported('immersive-vr');
    } catch {
      immersiveVr = false;
    }
  }

  return {
    webgl,
    webxr,
    immersiveVr,
    handTrackingHint: webxr && immersiveVr !== false,
  };
}

export function worldLoomXrFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORLD_LOOM_XR === 'enabled';
}
