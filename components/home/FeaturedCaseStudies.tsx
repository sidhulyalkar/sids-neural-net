'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MotionGlassCard, SectionHeader, TagPill, GlowButton } from '@/components/ui';

const featuredCaseStudies = [
  {
    slug: 'datajoint-multimodal-pipelines',
    title: 'DataJoint Multimodal Pipelines',
    summary:
      'Led and implemented cloud-ready DataJoint workflows for multimodal neuroscience data across major customer deployments including Harvard Sabatini Lab and Allen Institute.',
    tags: ['DataJoint', 'AWS', 'Docker', 'Kubernetes'],
    color: 'cyan',
    organization: 'DataJoint',
    dates: '2022-2024',
  },
  {
    slug: 'neatlabs-core-research',
    title: 'NEATLABs Neural Engineering',
    summary:
      'Built the computational backbone for large-scale rodent electrophysiology and behavior studies as Lead Lab Programmer, combining MATLAB pipelines, spectral methods, and computational modeling.',
    tags: ['LFP', 'MATLAB', 'Neuroscience', 'Research'],
    color: 'violet',
    organization: 'UCSD NEATLABs',
    dates: '2017-2022',
  },
  {
    slug: 'neurofmx-neuros',
    title: 'neuroFMx / neurOS',
    summary:
      'Building a modular orchestration layer for BCI pipelines with tokenization, self-supervised learning, and real-time neural inference capabilities.',
    tags: ['Foundation Models', 'BCI', 'Real-Time', 'Python'],
    color: 'amber',
    organization: 'Personal Research',
    dates: '2024-Present',
  },
];

const colorClasses = {
  cyan: 'border-l-cyan',
  violet: 'border-l-violet',
  amber: 'border-l-amber',
  green: 'border-l-green',
  rose: 'border-l-rose',
};

export function FeaturedCaseStudies() {
  return (
    <section className="bg-bg-panel/20 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          title="Featured Projects"
          subtitle="The projects that best show the range: infrastructure, research software, model systems, and applied AI."
          accentColor="cyan"
        />

        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr_1.08fr]">
          {featuredCaseStudies.map((study, index) => (
            <motion.div
              key={study.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/case-studies/${study.slug}`}>
                <MotionGlassCard
                  glow={study.color as any}
                  className={`node-shell h-full border-l-2 bg-white/[0.025] ${colorClasses[study.color as keyof typeof colorClasses]} ${index === 1 ? 'lg:mt-12' : ''}`}
                >
                  <div className="flex flex-col h-full">
                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-text-muted mb-3">
                      <span>{study.organization}</span>
                      <span>{study.dates}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-black tracking-tight text-text-primary group-hover:text-cyan transition-colors">
                      {study.title}
                    </h3>

                    {/* Summary */}
                    <p className="mt-3 flex-grow text-sm text-text-secondary line-clamp-3">
                      {study.summary}
                    </p>

                    {/* Tags */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {study.tags.slice(0, 3).map((tag) => (
                        <TagPill key={tag} color={study.color as any}>
                          {tag}
                        </TagPill>
                      ))}
                    </div>

                    {/* Link indicator */}
                    <div className="mt-4 flex items-center text-sm text-cyan">
                      Open project brief
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </div>
                </MotionGlassCard>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <GlowButton href="/case-studies" variant="secondary">
            View Project Deep Dives
            <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </div>
      </div>
    </section>
  );
}
