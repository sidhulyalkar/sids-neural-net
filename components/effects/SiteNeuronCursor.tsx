'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isArcadeGamePath } from '@/lib/arcade/routeScope';

const NeuronCursor = dynamic(
  () => import('./NeuronCursor').then((module) => module.NeuronCursor),
  { ssr: false },
);

/**
 * Keep the decorative neural cursor off performance-isolated experiences.
 * FRONTIER reserves interaction budget for reading and compositor page swaps;
 * games reserve it for their own input runtimes.
 */
export function SiteNeuronCursor() {
  const pathname = usePathname();
  if (pathname?.startsWith('/frontier') || isArcadeGamePath(pathname)) return null;
  return <NeuronCursor />;
}
