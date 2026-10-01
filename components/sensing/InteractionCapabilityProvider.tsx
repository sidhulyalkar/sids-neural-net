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
 * Lightweight site-wide capability shell. Camera/MediaPipe only enter the
 * lifecycle after opt-in, and performance-isolated surfaces skip even this
 * shell so FRONTIER and arcade interactions keep uncontested main-thread/GPU
 * authority.
 */
export function InteractionCapabilityProvider() {
  const pathname = usePathname();
  const enabled = useSensingStore((state) => state.enabled);

  if (pathname?.startsWith('/sensing-lab') || pathname?.startsWith('/frontier') || isArcadeGamePath(pathname)) return null;

  return (
    <>
      <SensingToggle />
      {enabled ? <SensingRuntime /> : null}
    </>
  );
}
