'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isArcadeGamePath } from '@/lib/arcade/routeScope';
import { useSensingStore } from '@/lib/stores/sensingStore';

const SensingToggle = dynamic(
  () => import('./ui/SensingToggle').then((module) => module.SensingToggle),
  { ssr: false },
);

const SensingRuntime = dynamic(
  () => import('./SensingProvider').then((module) => module.SensingProvider),
  { ssr: false },
);

/**
 * Lightweight site-wide capability shell. It keeps only user intent and the
 * consent UI resident. Camera, MediaPipe, gesture controllers, and inference
 * code enter the bundle/lifecycle only after the visitor opts in.
 *
 * Game routes are intentionally isolated from the sensing stack so browser
 * pointer, keyboard, touch, and game controls keep uncontested interaction
 * authority inside the runtime.
 */
export function InteractionCapabilityProvider() {
  const pathname = usePathname();
  const enabled = useSensingStore((state) => state.enabled);

  if (pathname?.startsWith('/sensing-lab') || isArcadeGamePath(pathname)) return null;

  return (
    <>
      <SensingToggle />
      {enabled ? <SensingRuntime /> : null}
    </>
  );
}
