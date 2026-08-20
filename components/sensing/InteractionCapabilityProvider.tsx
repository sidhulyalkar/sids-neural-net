'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { SensingToggle } from './ui/SensingToggle';

const SensingRuntime = dynamic(
  () => import('./SensingProvider').then((module) => module.SensingProvider),
  { ssr: false },
);

/**
 * Lightweight site-wide capability shell. It keeps only user intent and the
 * consent UI resident. Camera, MediaPipe, gesture controllers, and inference
 * code enter the bundle/lifecycle only after the visitor opts in.
 */
export function InteractionCapabilityProvider() {
  const pathname = usePathname();
  const enabled = useSensingStore((state) => state.enabled);
  if (pathname?.startsWith('/sensing-lab')) return null;
  return (
    <>
      <SensingToggle />
      {enabled ? <SensingRuntime /> : null}
    </>
  );
}
