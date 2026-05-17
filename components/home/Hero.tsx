'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Network, FileText, Clock } from 'lucide-react';
import { GlowButton } from '@/components/ui';
import { ConstellationBackground } from './ConstellationBackground';

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <ConstellationBackground />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5 text-sm text-cyan"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            Building adaptive AI systems for biological complexity
          </motion.div>

          {/* Title */}
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="block">Sid&apos;s</span>
            <span className="mt-2 block bg-gradient-to-r from-cyan via-violet to-rose bg-clip-text text-transparent">
              Neural Net
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-3xl text-lg text-text-secondary sm:text-xl">
            A living atlas of the systems, models, experiments, and adventures shaping how I think.
          </p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mx-auto mt-6 max-w-2xl text-base text-text-muted"
          >
            I&apos;m <span className="text-text-primary font-medium">Sidharth Hulyalkar</span>, an applied AI scientist
            and neuroscience systems engineer building adaptive ML systems for biological complexity:
            multimodal neural data pipelines, foundation models for brain dynamics, mechanistic
            interpretability tools, clinical intelligence products, and real-time experimental infrastructure.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <GlowButton href="/neural-net" size="lg">
              <Network className="h-5 w-5" />
              Explore the Neural Net
              <ArrowRight className="h-4 w-4" />
            </GlowButton>
            <GlowButton href="/case-studies" variant="secondary" size="lg">
              <FileText className="h-5 w-5" />
              View Case Studies
            </GlowButton>
            <GlowButton href="/timeline" variant="ghost" size="lg">
              <Clock className="h-5 w-5" />
              Timeline
            </GlowButton>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-text-muted"
          >
            <span className="text-xs uppercase tracking-wider">Scroll to explore</span>
            <div className="h-8 w-5 rounded-full border border-white/20 p-1">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-cyan"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
