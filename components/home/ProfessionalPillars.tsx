'use client';

import { motion } from 'framer-motion';
import {
  Database,
  Brain,
  Search,
  Cpu,
  Radio,
  Rocket,
} from 'lucide-react';
import { MotionGlassCard, SectionHeader } from '@/components/ui';

const pillars = [
  {
    icon: Database,
    title: 'Neural Data Infrastructure',
    description:
      'Reproducible pipelines for calcium imaging, electrophysiology, pose estimation, fiber photometry, behavior, and scientific workflow automation.',
    color: 'cyan',
    tags: ['DataJoint', 'AWS', 'Docker', 'Kubernetes'],
  },
  {
    icon: Brain,
    title: 'Foundation Models for Brain Dynamics',
    description:
      'Tokenization, alignment, self-supervised learning, long-context modeling, and real-time neural inference for multimodal brain data.',
    color: 'violet',
    tags: ['neurOS', 'neuroFMx', 'Transformers'],
  },
  {
    icon: Search,
    title: 'Mechanistic Interpretability',
    description:
      'Tools for circuit discovery, path patching, latent interventions, and making complex models scientifically useful.',
    color: 'amber',
    tags: ['Circuit Analysis', 'Interventions', 'Probing'],
  },
  {
    icon: Cpu,
    title: 'Applied AI Products',
    description:
      'Clinical trial intelligence, evaluation systems, RAG workflows, and production ML infrastructure for real-world decision-making.',
    color: 'green',
    tags: ['Panoptic Bio', 'Clinical AI', 'RAG'],
  },
  {
    icon: Radio,
    title: 'BCI & Real-Time Systems',
    description:
      'Low-latency neural decoding, closed-loop experimental control, and adaptive interfaces for brain-computer interaction.',
    color: 'rose',
    tags: ['NeuroForge', 'Real-Time', 'Decoding'],
  },
  {
    icon: Rocket,
    title: 'Personal Product Experiments',
    description:
      'Side projects exploring pet fitness tracking, social platforms, and curiosity-driven technical experiments.',
    color: 'blue',
    tags: ['Woof', 'PetPath', 'Side Projects'],
  },
];

const colorClasses = {
  cyan: 'text-cyan bg-cyan/10 border-cyan/20',
  violet: 'text-violet bg-violet/10 border-violet/20',
  amber: 'text-amber bg-amber/10 border-amber/20',
  green: 'text-green bg-green/10 border-green/20',
  rose: 'text-rose bg-rose/10 border-rose/20',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const iconColorClasses = {
  cyan: 'text-cyan',
  violet: 'text-violet',
  amber: 'text-amber',
  green: 'text-green',
  rose: 'text-rose',
  blue: 'text-blue-400',
};

export function ProfessionalPillars() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          title="What I Build"
          subtitle="Six pillars spanning neuroscience infrastructure, applied AI, and creative experimentation."
          accentColor="violet"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <MotionGlassCard
                glow={pillar.color as any}
                className="h-full"
              >
                <div className="flex flex-col h-full">
                  {/* Icon */}
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border ${colorClasses[pillar.color as keyof typeof colorClasses]}`}
                  >
                    <pillar.icon className={`h-6 w-6 ${iconColorClasses[pillar.color as keyof typeof iconColorClasses]}`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-text-primary">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 flex-grow text-sm text-text-secondary">
                    {pillar.description}
                  </p>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pillar.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </MotionGlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
