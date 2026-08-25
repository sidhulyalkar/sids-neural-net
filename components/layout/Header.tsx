'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FractalThemeEcho } from '@/components/neural-atlas/FractalThemeEcho';

export function Header() {
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <Link
      href="/"
      aria-label="Return home"
      className="group fixed left-3 top-3 z-50 flex h-12 w-16 items-center justify-center focus:outline-none sm:left-5 sm:top-5"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 80 56"
        fill="none"
      >
        <polyline
          points="-4,12 12,14 22,20 34,28 46,32 58,30"
          stroke="rgba(205,225,220,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <polyline
          points="18,18 28,17 35,20 43,27"
          stroke="rgba(102,227,255,0.18)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <polyline
          points="35,28 29,38 20,43 8,46"
          stroke="rgba(168,142,255,0.14)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <polygon
          points="62 16 74 23 74 37 62 44 50 37 50 23"
          fill="rgba(2,3,6,0.68)"
          stroke="rgba(205,225,220,0.34)"
          strokeWidth="1"
          className="transition-all duration-200 group-hover:fill-cyan/[0.05] group-hover:stroke-cyan/65"
        />
      </svg>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[4px] top-[13px] h-[24px] w-[20px] overflow-hidden opacity-55 transition-opacity duration-200 group-hover:opacity-95"
        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
      >
        <FractalThemeEcho variant="glyph" />
      </span>
      <span className="pointer-events-none absolute right-[8px] top-[13px] z-10 flex h-6 w-3 items-center justify-center font-mono text-[14px] text-cyan/75 transition-colors group-hover:text-cyan">
        ‹
      </span>
    </Link>
  );
}
