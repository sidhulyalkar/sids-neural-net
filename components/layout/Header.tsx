'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Brain, Sparkles } from 'lucide-react';
import { ModeToggle } from './ModeToggle';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/neural-net', label: 'Neural Net' },
  { href: '/projects', label: 'Projects' },
  { href: '/publications', label: 'Publications' },
  { href: '/case-studies', label: 'Case Studies' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/life', label: 'Life' },
  { href: '/about', label: 'About' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-bg-deep/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative">
            <Brain className="h-8 w-8 text-cyan transition-colors group-hover:text-cyan-300" />
            <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-amber opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-text-primary">Sid&apos;s</span>{' '}
            <span className="bg-gradient-to-r from-cyan to-violet bg-clip-text text-transparent">
              Neural Net
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-cyan'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {link.label}
              {pathname === link.href && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan to-violet"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* Mode Toggle & Mobile Menu Button */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <ModeToggle />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-text-secondary hover:bg-white/5 hover:text-text-primary lg:hidden"
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
            className="border-t border-white/10 bg-bg-deep/95 backdrop-blur-xl lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-base font-medium transition-colors',
                    pathname === link.href
                      ? 'bg-cyan/10 text-cyan'
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
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
    </header>
  );
}
