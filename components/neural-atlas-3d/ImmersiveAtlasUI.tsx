'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/publications', label: 'Publications' },
  { href: '/neural-net', label: 'Full Graph' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function ImmersiveAtlasUI() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Minimal menu icon - upper left */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed left-6 top-6 z-50 p-3 border border-white/10 bg-black/40 backdrop-blur-sm hover:border-white/30 hover:bg-black/60 transition-all group"
        aria-label="Open navigation menu"
      >
        <Menu className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" />
      </button>

      {/* Name at bottom - all caps, square font */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex justify-center pb-8">
          <h1 className="atlas-name-display text-white/90 tracking-[0.35em] text-center">
            SIDHARTH HULYALKAR
          </h1>
        </div>
      </div>

      {/* Fullscreen menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl"
          >
            {/* Close button */}
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-6 top-6 p-3 border border-white/10 hover:border-white/30 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6 text-white/70 hover:text-white" />
            </button>

            {/* Navigation links */}
            <nav className="h-full flex flex-col items-center justify-center gap-6">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="group flex items-center gap-4 text-2xl sm:text-3xl font-light tracking-[0.2em] text-white/60 hover:text-white transition-colors uppercase"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Subtle name at bottom of menu */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <span className="text-xs tracking-[0.4em] text-white/30 uppercase">
                Neural Atlas
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
