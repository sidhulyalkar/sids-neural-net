'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { NeuralBackground } from './NeuralBackground';

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
  const headerInitial = reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 };
  const enterInitial = reduceMotion ? false : { opacity: 0, y: 24 };

  return (
    <div className="relative min-h-screen overflow-hidden pt-16">
      <NeuralBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.header
          initial={headerInitial}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.7 }}
          className="max-w-3xl"
        >
          <h1 className="font-mono text-lg font-normal lowercase leading-tight tracking-[0.04em] text-text-primary sm:text-xl">
            {title}
          </h1>
          {intro && <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary/80">{intro}</p>}
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
