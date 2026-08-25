'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ThemedNeuralBackground } from './ThemedNeuralBackground';

type ComicSectionLayoutProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  sideNote?: ReactNode;
};

export function ComicSectionLayout({
  eyebrow,
  title,
  intro,
  children,
  sideNote,
}: ComicSectionLayoutProps) {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const headerInitial = reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 };
  const enterInitial = reduceMotion ? false : { opacity: 0, y: 24 };
  const showFrontierShortcut = pathname !== '/contact';

  return (
    <div className="relative min-h-screen overflow-hidden pt-16">
      <ThemedNeuralBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.header
          initial={headerInitial}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.7 }}
          className="flex max-w-4xl items-start justify-between gap-4 sm:gap-5"
        >
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-cyan/55">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="font-mono text-lg font-normal lowercase leading-tight tracking-[0.04em] text-text-primary sm:text-xl">
              {title}
            </h1>
            {intro && <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary/80">{intro}</p>}
          </div>

          {showFrontierShortcut ? (
            <Link
              href="/frontier"
              aria-label="Open FRONTIER personal intelligence radar"
              className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-cyan/15 bg-black/20 px-2.5 py-2 font-mono text-[0.52rem] uppercase tracking-[0.12em] text-cyan/65 transition-all hover:-translate-y-px hover:border-cyan/35 hover:bg-cyan/[0.055] hover:text-cyan sm:px-3 sm:text-[0.56rem] sm:tracking-[0.14em]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/45 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
              </span>
              Frontier
            </Link>
          ) : null}
        </motion.header>

        {sideNote && (
          <motion.aside
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.18, duration: reduceMotion ? 0 : 0.6 }}
            className="sr-only"
          >
            {sideNote}
          </motion.aside>
        )}

        <motion.div
          initial={enterInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.22, duration: reduceMotion ? 0 : 0.72 }}
          className="mt-8"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
