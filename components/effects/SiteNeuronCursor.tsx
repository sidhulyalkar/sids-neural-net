'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isArcadeGamePath } from '@/lib/arcade/routeScope';

const NeuronCursor = dynamic(
  () => import('./NeuronCursor').then((module) => module.NeuronCursor),
  { ssr: false },
);

/**
 * Keep the decorative neural cursor off interactive game routes entirely.
 * Games need the browser's ordinary pointer and should not spend work on a
 * second site-level pointer renderer while an iframe owns interaction.
 */
export function SiteNeuronCursor() {
  const pathname = usePathname();
  if (isArcadeGamePath(pathname)) return null;
  return <NeuronCursor />;
}
