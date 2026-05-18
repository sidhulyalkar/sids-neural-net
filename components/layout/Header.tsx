'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Brain, Sparkles, Search, ArrowUpRight, Map } from 'lucide-react';
import { ModeToggle } from './ModeToggle';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/publications', label: 'Publications' },
  { href: '/photography', label: 'Photography' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/field-notes', label: 'Experiments' },
  { href: '/neural-net', label: 'Full Graph' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (pathname === '/') {
    return null;
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-3">
      <nav className="mx-auto flex max-w-7xl items-center justify-between border border-white/10 bg-bg-deep/70 px-3 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl neural-panel-cut sm:px-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative">
            <Brain className="h-8 w-8 text-cyan transition-colors group-hover:text-cyan-300" />
            <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-amber opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="text-base font-black tracking-tight sm:text-lg">
            <span className="text-text-primary">Sid</span>{' '}
            <span className="bg-gradient-to-r from-cyan to-violet bg-clip-text text-transparent">
              Neural Net
            </span>
          </span>
        </Link>

        {/* Mode Toggle & Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-text-muted transition-colors hover:border-cyan/30 hover:text-cyan md:flex"
            aria-label="Open command palette"
          >
            <Map className="h-4 w-4" />
            <span>Map</span>
          </button>
          <div className="hidden sm:block">
            <ModeToggle />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 text-text-secondary hover:bg-white/5 hover:text-text-primary"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 border border-white/10 bg-bg-deep/95 backdrop-blur-xl neural-panel-cut"
          >
            <div className="space-y-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-base font-medium transition-colors',
                    'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-white/10 pt-4 sm:hidden">
                <ModeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-bg-deep/70 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="neural-panel neural-panel-cut mx-auto mt-20 max-w-2xl p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
                <Search className="h-5 w-5 text-cyan" />
                <div>
                  <p className="technical-label">Command Interface</p>
                  <p className="text-sm text-text-muted">Jump into a layer of the neural operating system.</p>
                </div>
              </div>
              <div className="grid gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setPaletteOpen(false)}
                    className="group flex items-center justify-between border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-text-secondary transition-colors hover:border-cyan/[0.35] hover:bg-cyan/10 hover:text-text-primary"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-cyan" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
