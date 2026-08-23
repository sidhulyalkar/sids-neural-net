import dynamic from 'next/dynamic';
import { DendriticPortalLink } from '@/components/home/DendriticPortalLink';

/**
 * Homepage - Minimal Dendritic Landing
 *
 * The neural map stays faithful to the original six-branch morphology.
 * FRONTIER and Game Network are intentionally peripheral controls rather
 * than additional dendrites, so new product surfaces cannot distort the
 * visual identity of the landing page.
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
    detail: 'live radar',
    ariaLabel: 'Open FRONTIER personal intelligence radar',
    tone: 'cyan' as const,
  },
  {
    href: '/arcade',
    label: 'GAME NETWORK',
    detail: 'arcade',
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
      >
        {peripheralLinks.map((link) => (
          <DendriticPortalLink key={link.href} {...link} />
        ))}
      </nav>
    </>
  );
}
