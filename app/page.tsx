import dynamic from 'next/dynamic';
import { DendriticPortalLink } from '@/components/home/DendriticPortalLink';

/**
 * Homepage - original dendritic specimen, modern product surface.
 *
 * The six organic primary dendrites remain the permanent visual identity of
 * the site. Product surfaces that can evolve independently, such as FRONTIER
 * and Game Network, attach as small peripheral neural portals instead of
 * changing the underlying morphology every time the portfolio grows.
 */
const MinimalDendriteHome = dynamic(
  () => import('@/components/neural-atlas-canvas').then((module) => module.MinimalDendriteHome),
  {
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[#020306]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full border border-white/20" />
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-white/40">
            Loading neural atlas
          </p>
        </div>
      </div>
    ),
  }
);

const peripheralLinks = [
  {
    href: '/frontier',
    label: 'FRONTIER',
    detail: 'radar · drift',
    ariaLabel: 'Open FRONTIER live discovery with Radar, Signal Drift, Rabbit Holes and waterfall search',
    tone: 'cyan' as const,
  },
  {
    href: '/arcade',
    label: 'GAME NETWORK',
    detail: '2 live builds',
    ariaLabel: 'Open the Game Network',
    tone: 'violet' as const,
  },
] as const;

export default function HomePage() {
  return (
    <>
      <MinimalDendriteHome />

      <nav
        aria-label="Homepage peripheral destinations"
        className="fixed right-0 top-4 z-[70] flex flex-col items-end gap-1 sm:top-7"
        data-home-peripheral-portals
      >
        {peripheralLinks.map((link) => (
          <DendriticPortalLink key={link.href} {...link} />
        ))}
      </nav>
    </>
  );
}
