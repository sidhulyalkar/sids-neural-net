import dynamic from 'next/dynamic';
import Link from 'next/link';

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
    ariaLabel: 'Open FRONTIER personal intelligence radar',
    accentClass: 'hover:border-cyan/35 hover:text-cyan focus-visible:ring-cyan/70',
  },
  {
    href: '/arcade',
    label: 'GAME NETWORK',
    ariaLabel: 'Open the Game Network',
    accentClass: 'hover:border-violet/35 hover:text-violet focus-visible:ring-violet/70',
  },
] as const;

export default function HomePage() {
  return (
    <>
      <MinimalDendriteHome />

      <nav
        aria-label="Homepage peripheral destinations"
        className="fixed right-4 top-4 z-[70] flex flex-col items-end gap-2 sm:right-7 sm:top-7"
      >
        {peripheralLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            data-gesture-target
            aria-label={link.ariaLabel}
            className={`group inline-flex items-center gap-2 border border-white/12 bg-black/55 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/55 backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-1 ${link.accentClass}`}
          >
            {link.label}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
