'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const footerLinks = [
  { href: '/about', label: 'Core' },
  { href: '/projects', label: 'Builds' },
  { href: '/arcade', label: 'Game Network' },
  { href: '/publications', label: 'Papers' },
  { href: '/ideas', label: 'Research' },
  { href: '/photography', label: 'Visual Cortex' },
  { href: '/contact', label: 'Contact' },
];

export function Footer() {
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <footer className="relative z-10 border-t border-white/8 px-4 py-4">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[0.58rem] uppercase tracking-[0.12em]">
        {footerLinks.map((link, i) => (
          <span key={link.href} className="flex items-center gap-4">
            <Link
              href={link.href}
              className={`transition-colors hover:text-cyan/80 ${
                pathname === link.href ? 'text-cyan/60' : 'text-white/30'
              }`}
            >
              {link.label}
            </Link>
            {i < footerLinks.length - 1 && (
              <span className="text-white/15">·</span>
            )}
          </span>
        ))}
      </nav>
    </footer>
  );
}
