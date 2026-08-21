'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const contextLabel = {
  '/about': 'core',
  '/projects': 'builds',
} as const;

export function ArcadeDiscovery() {
  const pathname = usePathname();
  const section = contextLabel[pathname as keyof typeof contextLabel];
  if (!section) return null;

  return (
    <div className="relative z-20 mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
      <Link
        href="/arcade"
        data-gesture-target
        aria-label={`Open Game Network from ${section}`}
        className="group inline-flex items-center gap-2 border-b border-white/10 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 transition-colors hover:border-cyan/30 hover:text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/60"
      >
        <span>{section}</span>
        <span className="text-white/15">·</span>
        <span>game network</span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </div>
  );
}
