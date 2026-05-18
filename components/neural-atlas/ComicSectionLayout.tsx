'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { NeuralBackground } from './NeuralBackground';

type ComicSectionLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
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
  return (
    <div className="relative min-h-screen overflow-hidden pt-24">
      <NeuralBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-cyan">
          <ArrowLeft className="h-4 w-4" />
          Return to atlas
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan/75">{eyebrow}</p>
            <h1 className="mt-4 max-w-5xl text-5xl font-black leading-[0.94] text-text-primary md:text-7xl">
              {title}
            </h1>
          </div>
          <div className="comic-panel comic-panel-large p-5">
            <p className="text-lg leading-8 text-text-secondary">{intro}</p>
          </div>
        </motion.header>

        {sideNote && (
          <motion.aside
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="comic-annotation mt-8 max-w-2xl p-4"
          >
            {sideNote}
          </motion.aside>
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.72 }}
          className="mt-12"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
