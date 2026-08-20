'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const contextCopy = {
  about: {
    eyebrow: 'CORE // PLAYGROUND',
    title: 'Game Arcade',
    description: 'A playable corner of the portfolio: Stretchicorn, uniRico, Mosslight, and the next experiments that escape the lab.',
  },
  builds: {
    eyebrow: 'BUILDS // PLAYABLE',
    title: 'Game Arcade',
    description: 'Run the interactive builds directly in-browser, with controls, fullscreen, and isolated game runtimes.',
  },
} as const;

export function ArcadeDiscovery() {
  const pathname = usePathname();

  if (pathname === '/') {
    return (
      <Link
        href="/arcade"
        aria-label="Open the game arcade"
        className="group fixed bottom-5 right-4 z-40 rounded-xl border border-violet/35 bg-bg-deep/90 px-4 py-3 font-mono shadow-[0_0_28px_rgba(168,142,255,0.12)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-violet/70 hover:bg-violet/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/70 sm:bottom-7 sm:right-7"
      >
        <span className="block text-[9px] uppercase tracking-[0.22em] text-violet/65">Core playground</span>
        <span className="mt-1 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-text-primary">
          Game Arcade
          <span aria-hidden="true" className="text-violet transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  }

  const context = pathname === '/about' ? contextCopy.about : pathname === '/projects' ? contextCopy.builds : null;
  if (!context) return null;

  return (
    <div className="relative z-20 mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <Link
        href="/arcade"
        className="group flex flex-col gap-3 rounded-2xl border border-violet/25 bg-violet/[0.035] px-5 py-4 shadow-[0_0_35px_rgba(168,142,255,0.06)] transition-all hover:border-violet/55 hover:bg-violet/[0.065] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-violet/65">{context.eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-mono text-base uppercase tracking-[0.12em] text-text-primary">{context.title}</h2>
            <p className="max-w-3xl text-xs leading-5 text-text-secondary">{context.description}</p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-violet">
          Enter arcade <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    </div>
  );
}
