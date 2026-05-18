'use client';

import { motion } from 'framer-motion';
import { ArrowDown, Sparkles } from 'lucide-react';
import { GlowButton } from '@/components/ui';
import { ConstellationBackground } from './ConstellationBackground';

const bootLines = [
  'loading neural data infrastructure...',
  'syncing multimodal research pipelines...',
  'mapping: neurOS / NeuroForge / DataJoint / Panoptic...',
  'status: building systems at the neuron-network boundary',
];

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-24">
      {/* Background */}
      <ConstellationBackground />

      {/* Content */}
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 py-20 lg:grid-cols-[1fr_0.82fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-left"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 border border-cyan/30 bg-cyan/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-cyan neural-panel-cut"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            Applied AI · Neural Systems · Infrastructure
          </motion.div>

          {/* Title */}
          <h1 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-tight text-text-primary sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Sidharth</span>
            <span className="mt-2 block bg-gradient-to-r from-cyan via-cyan-100 to-violet bg-clip-text text-transparent">
              Hulyalkar
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-7 max-w-3xl text-xl font-medium text-text-primary sm:text-2xl">
            Building infrastructure where neurons meet neural networks.
          </p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-5 max-w-2xl text-base text-text-secondary"
          >
            Neuroscience data systems. Multimodal ML pipelines. Real-time BCI frameworks.
            Foundation models for neural data. Mechanistic interpretability tools.
            Applied AI products with research depth.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <GlowButton href="#brain-world" size="lg">
              <Sparkles className="h-5 w-5" />
              Explore the Atlas
              <ArrowDown className="h-4 w-4" />
            </GlowButton>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="neural-panel neural-panel-cut relative p-5"
        >
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <span className="technical-label">Boot Sequence</span>
            <span className="h-2 w-2 rounded-full bg-green shadow-glow-green" />
          </div>
          <div className="space-y-3 font-mono text-xs text-text-secondary sm:text-sm">
            {bootLines.map((line, index) => (
              <motion.div
                key={line}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + index * 0.16 }}
                className="flex gap-3"
              >
                <span className="text-cyan/60">0{index + 1}</span>
                <span>{line}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 h-32 overflow-hidden border border-white/10 bg-black/30 p-3">
            <svg viewBox="0 0 420 110" className="h-full w-full" aria-hidden="true">
              <path
                d="M0 62 C30 18 58 96 87 54 S146 52 176 38 S235 86 270 50 S332 25 420 64"
                fill="none"
                stroke="rgba(102,227,255,0.75)"
                strokeWidth="2"
                strokeDasharray="7 10"
                className="pulse-line"
              />
              <path
                d="M0 78 C34 75 46 24 76 40 S134 94 168 66 S218 22 250 56 S308 88 420 35"
                fill="none"
                stroke="rgba(167,139,250,0.35)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
