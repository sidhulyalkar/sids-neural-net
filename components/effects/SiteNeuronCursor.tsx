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
 * FRONTIER owns its pointer budget for page turns/media, while arcade routes
 * need the browser's ordinary pointer for game input.
 */
export function SiteNeuronCursor() {
  const pathname = usePathname();
  if (pathname?.startsWith('/frontier') || isArcadeGamePath(pathname)) return null;
  return <NeuronCursor />;
}
