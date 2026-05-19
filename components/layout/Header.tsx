'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
        {/* Dendrite lines */}
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
        {/* Single hexagon */}
        <polygon
          points="62 16 74 23 74 37 62 44 50 37 50 23"
          fill="rgba(2,3,6,0.82)"
          stroke="rgba(205,225,220,0.32)"
          strokeWidth="1"
          className="transition-all duration-200 group-hover:fill-cyan/[0.08] group-hover:stroke-cyan/60"
        />
        <text
          x="62"
          y="34"
          textAnchor="middle"
          className="fill-cyan/70 font-mono text-[14px] transition-colors group-hover:fill-cyan"
        >
          ‹
        </text>
      </svg>
    </Link>
  );
}
